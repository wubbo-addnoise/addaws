class DatabaseEditView extends ModalView {
    viewDidLoad() {
        this.element.querySelector("form").addEventListener("submit", (event) => this.onSubmit(event));
        this.form = new DomUtils.Form(this.element.querySelector("form"));
    }

    viewDidAppear() {
        if (!this.database) {
            this.element.querySelector("h2").innerHTML = "Database toevoegen aan " + this.server;

        } else {
            this.element.querySelector("h2").innerHTML = "Database aanpassen: " + this.database + " @ " + this.server;
        }

        this.clientsTable.getItems().then(items => {
            let select = this.form.getField("client");
            select.clearOptions();
            for (let i = 0; i < items.length; i++) {
                select.addOption(items[i].uid, items[i].info.name);
            }

            Plugins.select(this.element);

            if (this.database) {
                this.databasesTable.getItem({ server: this.server, database: this.database }).then(item => {
                    this.form.getField("name").setValue(item.database);
                    this.form.getField("client").setValue(item.info.client);
                    this.form.getField("based_on").setValue((item.info.based_on == "addsite_live" || item.info.based_on == "addsite_object") ? item.info.based_on : "other");
                    this.form.getField("based_on_other").setValue(item.info.based_on);
                });
            } else {
                this.form.clearValues();
            }
        });
    }

    onSubmit(event) {
        event.preventDefault();

        let loader = new Ux.Loader(this.element);

        let values = this.form.getValues();

        if (this.database) {
            let data = {
                based_on: values.based_on == "other" ? values.based_on_other : values.based_on,
                client: values.client
            };

            this.databasesTable.update({ server: this.server, database: this.database }, data).then(() => {
                loader.stop("success", "De wijzigingen zijn opgeslagen").then(() => this.modal.close())
            });

        } else {
            let data = {
                server: this.server,
                database: values.name,
                client: values.client
            };
            if (values.based_on == "other") {
                if (values.based_on_other) {
                    data.based_on = values.based_on_other;
                }
            } else {
                data.based_on = values.based_on;
            }

            this.databasesTable.insert(data).then(() => {
                loader.stop("success", "De wijzigingen zijn opgeslagen", [ 2000, "button" ]).then(() => this.modal.close())
            });
        }
    }

}

class DatabaseDetailView extends ModalView {
    viewDidLoad() {
        this.domTable = new Dom.Table();
        this.domTable
            .addColumn("name", "Database")
            .addColumn("based_on", "Gebaseerd op")
            .addColumn("client", "Klant")
            .addColumn("usage", "Gebruik", { content: formatFileSize })
            .addColumn("_", "_", { align: "right" });
        this.element.querySelector(".content").appendChild(this.domTable.element);

        this.ready = true;
        this.invalidated = false;
    }

    viewDidAppear() {
        this.invalidated = true;

        if (this.dbName) {
            this.element.querySelector("h2").innerHTML = this.dbName;
            if (this.ready) {
                this.refresh();
            }

        } else {
            this.element.querySelector("h2").innerHTML = "Database toevoegen";
        }
    }

    refresh() {
        this.domTable.clearRows();

        this.databasesTable.findItems({ server: this.dbName }).then(items => {
            for (let i = 0; i < items.length; i++) {
                this.domTable.addRow({
                    name: items[i].database,
                    based_on: items[i].info.based_on || "",
                    client: items[i].info.client,
                    usage: items[i].info.usage||0,
                    _: `<a href="#" data-action="editDatabase(${items[i].database})">Aanpassen <i class="material-icons">chevron_right</i></a>`
                });
                ((index, db) => {
                    this.clientsTable.getItem(db.info.client).then(client => {
                        this.domTable.getCell(index, "client").setHtml(client.info.name);
                    });
                })(i, items[i]);
            }
            this.invalidated = false;
        });
    }

    addDatabase() {
        this.editDatabase();
    }

    editDatabase(name) {
        if (!this.editView) {
            this.editView = new DatabaseEditView(
                document.getElementById("database-edit-modal"),
                { server: this.dbName, database: name, databasesTable: this.databasesTable, clientsTable: this.clientsTable }
            );
            this.editView.viewWillDisappear = () => this.refresh();
        } else {
            this.editView.server = this.dbName;
            this.editView.database = name;
            this.editView.modal.open();
        }
    }
}

class DatabasesView extends View {
    viewDidLoad() {
        this.domTable = new Dom.Table();
        this.domTable
            .addColumn("name", "Database Server")
            .addColumn("status", "Status")
            .addColumn("num_db", "Aantal databases")
            .addColumn("usage", "Gebruik", { content: formatFileSize });
            //.addColumn("_", "_", { align: "right" });
        this.element.querySelector(".content").appendChild(this.domTable.element);

        this.invalidated = true;
        this.ready = false;

        this.databasesTable.ensureExistence({ "server": [ "HASH", "S" ], "database": [ "RANGE", "S" ] })
            .then(() => {
                this.ready = true;
                if (this.invalidated) {
                    this.refresh();
                }
            })
            .catch((err) => {
                console.log(err);
            });

    }

    viewDidAppear() {
        if (this.invalidated && this.ready) {
            this.refresh();
        }
    }

    refresh() {
        this.domTable.clearRows();

        this.dataSource.each((db) => {
            this.domTable.addRow({
                name: `<a href="#" data-action="showDetail(${db.DBInstanceIdentifier})">${db.DBInstanceIdentifier}</a>`,
                status: db.DBInstanceStatus,
            }, db.DBInstanceIdentifier);
        }).then(() => {
            this.databasesTable.getItems().then(items => {
                let servers = {};
                let usage = {};

                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    if (!(item.server in servers)) {
                        servers[item.server] = { numDbs: 0, usage: 0 };
                    }

                    servers[item.server].numDbs++;
                    if (item.info.usage) {
                        servers[item.server].usage += item.info.usage;
                    }
                }

                for (let name in servers) {
                    this.domTable.getCell(name, "num_db").setHtml(servers[name].numDbs);
                    this.domTable.getCell(name, "usage").setHtml(formatFileSize(servers[name].usage));
                }

                this.invalidated = false;
            });
        });
    }

    showDetail(name) {
        if (!this.detailView) {
            this.detailView = new DatabaseDetailView(
                document.getElementById("database-detail-modal"),
                { dbName: name, databasesTable: this.databasesTable, clientsTable: this.clientsTable }
            );
            this.detailView.viewWillDisappear = () => this.refresh();
        } else {
            this.detailView.dbName = name;
            this.detailView.modal.open();
        }
    }
}
