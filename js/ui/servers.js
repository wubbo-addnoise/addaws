class ServerDetailView extends ModalView {
    viewDidLoad() {
        Plugins.select(this.element);
        this.element.querySelector("form").addEventListener("submit", (event) => this.onSubmit(event));
        this.form = new DomUtils.Form(this.element.querySelector("form"));

        // this.serversTable.ensureExistence("S")
        //     .catch((err) => {
        //         console.log(err);
        //     });
    }

    viewDidAppear() {
        this.clientsTable.getItems().then(items => {
            let select = this.form.getField("client");
            select.clearOptions();
            for (let i = 0; i < items.length; i++) {
                select.addOption(items[i].uid, items[i].name);
            }

            Plugins.select(this.element);

            if (this.instance) {
                this.element.querySelector("h2").innerHTML = AWSUtils.getTag(this.instance, "Name", "(naamloos)");
                this.element.querySelector(".public-domain").innerHTML = this.instance.NetworkInterfaces[0].Association ? this.instance.NetworkInterfaces[0].Association.PublicDnsName : "(geen domein)";
                this.form.getField("client").setValue(AWSUtils.getTag(this.instance, "ClientId", ""));
            } else {
                this.form.clearValues();
            }
        });
    }

    onSubmit(event) {
        event.preventDefault();

        let clientId = this.form.getField("client").getValue();

        this.dataSource.ec2.createTags({
            Resources: [ this.instance.InstanceId ],
            Tags: [{
                Key: "ClientId",
                Value: clientId
            }]
        }, (err, data) => {
            if (err) {
                console.log(err, err.stack);
            }
            console.log(data);
            this.modal.close();
        });
    }
}

class ServersView extends View {
    viewDidLoad() {
        this.domTable = new Dom.Table();
        this.domTable
            .addColumn("name", "Server")
            .addColumn("client", "Klant")
            .addColumn("type", "Type")
            // .addColumn("domain", "Domein")
            .addColumn("status", "Status", { content: (value) => `<span class="status ${value}"></span> ${AWSUtils.translateStatus(value)}`, nowrap: true });
            // .addColumn("_", "_", { align: "right" });
        this.element.querySelector(".content").appendChild(this.domTable.element);
        this.invalidated = true;
    }

    viewDidAppear() {
        if (this.invalidated) {
            this.refresh();
        }
    }

    refresh() {
        let loader = new Ux.Loader(this.element);

        this.domTable.clearRows();
        this.instances = {};

        this.dataSource.refresh().each((instance) => {
            this.instances[instance.InstanceId] = instance;
            this.domTable.addRow({
                name: `<a href="#" data-action="showDetail(${instance.InstanceId})">${AWSUtils.getTag(instance, "Name", "(naamloos)")}</a>`,
                client: `<span data-client="${AWSUtils.getTag(instance, "ClientId")}">${AWSUtils.getTag(instance, "ClientId", "(geen)")}</span>`,
                type: instance.InstanceType,
                // domain: instance.NetworkInterfaces[0].Association ? instance.NetworkInterfaces[0].Association.PublicDnsName : "",
                status: instance.State.Name
            });
        }).then(() => {
            this.clientsTable.getItems().then(items => {
                for (let i = 0; i < items.length; i++) {
                    let spans = this.element.querySelectorAll(`[data-client="${items[i].uid}"]`);
                    for (let j = 0; j < spans.length; j++) {
                        spans[j].innerHTML = items[i].name;
                    }
                }
            });
            this.invalidated = false;
            loader.stop();
        });
    }

    showDetail(id) {
        let instance = id ? this.instances[id] : null;

        if (!this.detailView) {
            this.detailView = new ServerDetailView(document.getElementById("server-edit-modal"), {
                instance: instance,
                dataSource: this.dataSource,
                clientsTable: this.clientsTable
            });
            this.detailView.viewWillDisappear = () => this.refresh();
        } else {
            this.detailView.instance = instance;
            this.detailView.modal.open();
        }
    }
}
