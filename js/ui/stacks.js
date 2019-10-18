class StackDetailView extends ModalView {
    viewDidLoad() {
        Plugins.select(this.element);
        this.element.querySelector("form").addEventListener("submit", (event) => this.onSubmit(event));
        this.form = new DomUtils.Form(this.element.querySelector("form"));
    }

    viewDidAppear() {
        let input = this.form.getField("name");
        input.setValue(this.stack ? this.stack.uid : "");
        input.focus();

        async function fillSelects() {
            let items = await this.clientsTable.getItems();

            let select = this.form.getField("client");
            select.clearOptions();
            for (let i = 0; i < items.length; i++) {
                select.addOption(items[i].uid, items[i].name);
            }

            select = this.form.getField("database");
            await this.rdsDataSource.each((db) => {
                select.addOption(db.DBInstanceArn, db.DBInstanceIdentifier);
            });

            select = this.form.getField("efs");
            await this.efsDataSource.each((fs) => {
                select.addOption(fs.FileSystemId, fs.Name);
            });

            Plugins.select(this.element);
        }

        let loader = new Ux.Loader(this.element);

        fillSelects.call(this).then(() => {

            if (this.stack) {
                this.form.getField("client").setValue(this.stack.client);
                this.form.getField("efs_type").setValue(this.stack.efs_type);
                this.form.getField("efs").setValue(this.stack.efs);
                this.form.getField("db_type").setValue(this.stack.db_type);
                this.form.getField("database").setValue(this.stack.database);

            } else {
                this.form.clearValues();
            }

            loader.stop();

        });
    }

    onSubmit(event) {
        event.preventDefault();

        let values = this.form.getValues();
        let loader = new Ux.Loader(this.element);

        if (this.stack && ("status" in this.stack) && this.stack.status == "running") {
            let cloudFormation = new AWS.CloudFormation();
            cloudFormation.describeStackResources({ StackName: this.stack.uid }, (err, data) => {
                if (err) {
                    console.log(err);
                    return;
                }

                let elb = new AWS.ELBv2();

                for (let i = 0; i < data.StackResources.length; i++) {
                    let resource = data.StackResources[i];
                    switch (resource.ResourceType) {
                        case "AWS::AutoScaling::AutoScalingGroup":
                            let autoscaling = new AWS.AutoScaling();
                            autoscaling.createOrUpdateTags({
                                Tags: [{
                                    Key: "ClientId",
                                    Value: values.stack_client,
                                    ResourceId: resource.PhysicalResourceId,
                                    ResourceType: "auto-scaling-group",
                                    PropagateAtLaunch: true
                                }]
                            }, (err, data) => {
                                if (err) {
                                    console.log(err, err.stack);
                                }
                                console.log(data);
                            });
                            break;

                        case "AWS::ElasticLoadBalancingV2::TargetGroup":
                            elb.describeTargetHealth({
                                TargetGroupArn: resource.PhysicalResourceId
                            }, (err, data) => {
                                if (err) {
                                    console.log(err);
                                    return;
                                }

                                let resourceIds = data.TargetHealthDescriptions.map(th => th.Target.Id);
                                let ec2 = new AWS.EC2();
                                ec2.createTags({
                                    Resources: resourceIds,
                                    Tags: [{
                                        Key: "ClientId",
                                        Value: values.stack_client
                                    }]
                                }, (err, data) => {
                                    if (err) {
                                        console.log(err, err.stack);
                                    }
                                    console.log(data);
                                });
                            });
                            break;

                        case "AWS::ElasticLoadBalancingV2::LoadBalancer":
                            elb.addTags({
                                ResourceArns: [
                                    resource.PhysicalResourceId
                                ],
                                Tags: [{
                                    Key: "ClientId",
                                    Value: values.stack_client
                                }]
                            }, (err, data) => {
                                if (err) {
                                    console.log(err, err.stack);
                                }
                                console.log(data);
                            });
                            break;
                    }
                }
            });
        }

        if (this.stack) {
            this.stacksTable.update(this.stack.uid, values).then(() => {
                loader.stop("success", "De wijzigingen zijn opgeslagen").then(() => this.modal.close())
            });

        } else {
            values.uid = values.name;
            this.stacksTable.insert(values).then(() => {
                loader.stop("success", "De wijzigingen zijn opgeslagen").then(() => this.modal.close())
            });
        }
    }
}

class StacksView extends View {
    viewDidLoad() {
        this.stacksTable.ensureExistence("S")
            .catch((err) => {
                console.log(err);
            });
        this.cloudFormation = new AWS.CloudFormation();
        this.stacks = {};
        this.invalidated = true;

        this.domTable = new Dom.Table();
        this.domTable
            .addColumn("name", "Stack")
            .addColumn("client", "Klant")
            .addColumn("efs_type", "Opslag")
            .addColumn("db_type", "Database")
            .addColumn("status", "Status", { content: (value) => `<span class="status ${value}"></span> ${AWSUtils.translateStatus(value)}`, nowrap: true });
            // .addColumn("_", "_", { align: "right" });
        this.element.querySelector(".content").appendChild(this.domTable.element);
    }

    viewDidAppear() {
        if (this.invalidated) {
            this.refresh();
        }
    }

    refresh() {
        let loader = new Ux.Loader(this.element);

        this.stacksTable.getItems().then((items) => {
            this.domTable.clearRows();

            // items.sort((a, b) => a.uid.toLowerCase() < b.uid.toLowerCase() ? -1 : (a.uid.toLowerCase() > b.uid.toLowerCase() ? 1 : 0));

            for (let i = 0; i < items.length; i++) {
                let stack = items[i];
                this.stacks[stack.uid] = stack;
                this.domTable.addRow({
                    name: `<a href="#" data-action="showDetail(${stack.uid})">${stack.uid}</a>`,
                    client: stack.client,
                    status: stack.status || "running",
                    efs_type: stack.efs_type == "shared" ? '<i class="material-icons small">share</i> Gedeeld' : '<i class="material-icons small">lock</i> Eigen',
                    db_type: stack.db_type == "shared" ? '<i class="material-icons small">share</i> Gedeeld' : '<i class="material-icons small">lock</i> Eigen',
                    // _: `<a href="#" data-action="showDetail(${stack.uid})">Stack bekijken <i class="material-icons">chevron_right</i></a>`
                }, i);
                ((index, stack) => {
                    this.clientsTable.getItem(stack.client).then(client => {
                        this.domTable.getCell(index, "client").setHtml(client.name);
                    });
                })(i, stack);
            }

            this.invalidated = false;
            loader.stop();
        });
    }

    addStack() {
        this.showDetail();
    }

    showDetail(stackName) {
        let stack = stackName ? this.stacks[stackName] : null;
        if (!this.detailView) {
            this.detailView = new StackDetailView(document.getElementById("stack-edit-modal"), {
                stack: stack,
                stacksTable: this.stacksTable,
                clientsTable: this.clientsTable,
                rdsDataSource: this.rdsDataSource,
                efsDataSource: this.efsDataSource
            });
            this.detailView.viewWillDisappear = () => this.refresh();
        } else {
            this.detailView.stack = stack;
            this.detailView.modal.open();
        }
    }
}
