class ClientDetailView extends ModalView {
    viewDidLoad() {
        this.element.querySelector("form").addEventListener("submit", (event) => this.onSubmit(event));

        this.domStacksTable = new Dom.Table();
        this.domStacksTable
            .addColumn("name", "Naam")
            .addColumn("efs_type", "Opslag")
            .addColumn("db_type", "Database")
            .addColumn("status", "Status", { content: (value) => `<span class="status ${value}"></span> ${AWSUtils.translateStatus(value)}`, nowrap: true });
        this.element.querySelector(".stacks-content").appendChild(this.domStacksTable.element);

        this.domServersTable = new Dom.Table();
        this.domServersTable
            .addColumn("name", "Naam")
            .addColumn("id", "ID");
        this.element.querySelector(".servers-content").appendChild(this.domServersTable.element);

        this.domElbTable = new Dom.Table();
        this.domElbTable
            .addColumn("name", "Naam")
            .addColumn("id", "ID");
        this.element.querySelector(".elb-content").appendChild(this.domElbTable.element);

        this.domDbTable = new Dom.Table();
        this.domDbTable
            .addColumn("server", "Server")
            .addColumn("database", "Database")
            .addColumn("based_on", "Gebaseerd op")
            .addColumn("usage", "Gebruik", { content: formatFileSize });
        this.element.querySelector(".db-content").appendChild(this.domDbTable.element);

        this.domEfsTable = new Dom.Table();
        this.domEfsTable
            .addColumn("server", "Server")
            .addColumn("directory", "Directory")
            .addColumn("usage", "Gebruik", { content: formatFileSize });
        this.element.querySelector(".efs-content").appendChild(this.domEfsTable.element);
    }

    viewDidAppear() {
        if (this.clientId) {
            this.clientsTable.getItem(this.clientId).then((item) => {
                this.element.querySelector(".modal-title").innerHTML = item.info.name;
                this.element.querySelector("#client_name").value = item.info.name;
                this.element.querySelector(".delete.button").style.display = "inline-block";
            });

            this.domStacksTable.clearRows();
            this.domServersTable.clearRows();
            this.domElbTable.clearRows();
            this.domDbTable.clearRows();
            this.domEfsTable.clearRows();

            let resourceGroups = new AWS.ResourceGroups();
            let query = JSON.stringify({ ResourceTypeFilters: [ "AWS::AllSupported" ], TagFilters: [ { Key: "ClientId", Values: [ `${this.clientId}` ] }] });

            resourceGroups.searchResources({
                    ResourceQuery: {
                        Query: query,
                        Type: "TAG_FILTERS_1_0"
                    }
                },
                (err, data) => {
                    if (err) {
                        console.log(err);
                        return;
                    }

                    for (let i = 0; i < data.ResourceIdentifiers.length; i++) {
                        let resource = data.ResourceIdentifiers[i];
                        let m;
                        switch (resource.ResourceType) {
                            case "AWS::ElasticLoadBalancingV2::LoadBalancer":
                                m = resource.ResourceArn.match(/:loadbalancer\/app\/([^\/]+)\/(.+)$/);
                                this.domElbTable.addRow({
                                    name: m[1],
                                    id: m[2]
                                });
                                break;

                            case "AWS::EC2::Instance":
                                m = resource.ResourceArn.match(/:instance\/(.+)$/);
                                this.domServersTable.addRow({
                                    name: m[1],
                                    id: m[1]
                                }, m[1]);
                                (id => {
                                try {
                                    this.ec2DataSource.get(id).then(instance => {
                                        this.domServersTable.getCell(id, "name").setHtml(AWSUtils.getTag(instance, "Name"));
                                    });
                                } catch (e) {
                                    console.log(e);
                                }
                                })(m[1]);
                                break;
                        }
                    }
                });

            this.stacksTable.getItems().then(items => {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].info.stack_client == this.clientId) {
                        this.domStacksTable.addRow({
                            name: items[i].uid,
                            efs_type: items[i].info.stack_efs_type,
                            db_type: items[i].info.stack_db_type,
                            status: items[i].info.stack_status || "running",
                        });
                    }
                }
            });

            this.databasesTable.getItems().then(items => {
                let totalUsage = 0;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].info.client == this.clientId) {
                        this.domDbTable.addRow({
                            server: items[i].server,
                            database: items[i].database,
                            based_on: items[i].info.based_on || "",
                            usage: items[i].info.usage||0
                        });
                        if (items[i].info.usage) {
                            totalUsage += items[i].info.usage;
                        }
                    }
                }
                this.domDbTable.addRow({
                    server: '<strong>Totaal</strong>',
                    usage: totalUsage
                });
            });

            this.efsTable.getItems().then(items => {
                let totalUsage = 0;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].info.client == this.clientId) {
                        this.domEfsTable.addRow({
                            server: items[i].fsid,
                            directory: items[i].directory,
                            usage: items[i].info.usage||0
                        });
                        if (items[i].info.usage) {
                            totalUsage += items[i].info.usage;
                        }
                    }
                }
                this.domEfsTable.addRow({
                    server: '<strong>Totaal</strong>',
                    usage: totalUsage
                });
            });
        } else {
            this.element.querySelector("h2").innerHTML = "Klant toevoegen";
        }
    }

    onSubmit(event) {
        event.preventDefault();
        let form = event.target;
        let name = form.client_name.value;

        let docClient = new AWS.DynamoDB.DocumentClient();
        if (!this.clientId) {
            this.clientsTable.insert({
                name: name
            }).then(() => {
                this.modal.close();
            })
        } else {
            this.clientsTable.update(this.clientId, {
                name: name
            }).then(() => {
                this.modal.close();
            })
        }
    }

    delete() {
        Modal.confirm("Weet je zeker dat je deze klant wilt verwijderen?").then((result) => {
            if (result) {
                clientsTable.delete(this.clientId).then(() => {
                    this.modal.close();
                });
            }
        });
    }
}

class ClientAddView extends ModalView {
    constructor(element, clientsTable) {
        super(element, { clientsTable: clientsTable });
    }

    viewDidLoad() {
        Plugins.select(this.element);
        this.searchBox = SearchBox.attach(this.element.querySelector(".searchbox"));
        this.searchBox.onSelectItem = this.onSelectItem.bind(this);
    }

    viewDidAppear() {
        this.element.querySelector('input[name="query"]').focus();
    }

    onSelectItem(item) {
        let id = parseInt(item.getAttribute("data-id"));
        let title = item.getAttribute("data-title");

        this.clientsTable.getItem(id)
            .then((entry) => {
                console.log(entry);
                console.log("Item already exists");
                this.clientsTable.update(id, { name: title });
                this.modal.close();
            })
            .catch((err) => {
                this.clientsTable.insert({
                    uid: id,
                    name: title
                });
                this.modal.close();
            });
    }
}

class ClientsView extends View {
    viewDidLoad() {
        this.element.querySelector("button").addEventListener("click", (event) => this.onButtonClick(event));

        this.domTable = new Dom.Table();
        this.domTable
            .addColumn("name", "Klant")
            .addColumn("id", "ID");
            // .addColumn("_", "_", { align: "right" });
        this.element.querySelector(".content").appendChild(this.domTable.element);

        this.clientsTable.ensureExistence()
            .then(() => {
                this.refresh();
            })
            .catch((err) => {
                console.log(err);
            });
    }

    refresh() {
        let loader = new Ux.Loader(this.element);
        this.clientsTable.getItems().then((items) => {
            this.domTable.clearRows();

            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                this.domTable.addRow({
                    name: `<a href="#" data-action="showDetail(${item.uid})">${item.info.name}</a>`,
                    id: item.uid
                });
            }

            loader.stop();
        });
    }

    onButtonClick(event) {
        event.preventDefault();
        let view = new ClientAddView(document.getElementById("search-modal"), this.clientsTable);
        view.viewWillDisappear = () => this.refresh();
    }

    showDetail(uid) {
        if (!this.detailView) {
            this.detailView = new ClientDetailView(
                document.getElementById("client-detail-modal"),
                {
                    clientId: parseInt(uid),
                    clientsTable: this.clientsTable,
                    databasesTable: this.databasesTable,
                    stacksTable: this.stacksTable,
                    efsTable: this.efsTable,
                    ec2DataSource: this.ec2DataSource,
                }
            );
            this.detailView.viewWillDisappear = () => this.refresh();
        } else {
            this.detailView.clientId = parseInt(uid);
            this.detailView.modal.open();
        }
    }
}
