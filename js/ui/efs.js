class EFSDirectoryEditView extends ModalView {
    viewDidLoad() {
        this.element.querySelector("form").addEventListener("submit", (event) => this.onSubmit(event));
        this.form = new DomUtils.Form(this.element.querySelector("form"));
    }

    viewDidAppear() {
        if (!this.directory) {
            this.element.querySelector("h2").innerHTML = "Directory toevoegen aan " + this.fsName;

        } else {
            this.element.querySelector("h2").innerHTML = "Directory aanpassen: " + this.directory + " @ " + this.fsName;
        }

        this.clientsTable.getItems().then(items => {
            let select = this.form.getField("client");
            select.clearOptions();
            for (let i = 0; i < items.length; i++) {
                select.addOption(items[i].uid, items[i].info.name);
            }

            Plugins.select(this.element);

            if (this.directory) {
                this.efsTable.getItem({ fsid: this.fsId, directory: this.directory }).then(item => {
                    console.log(item);
                    this.form.getField("name").setValue(item.directory);
                    this.form.getField("client").setValue(item.info.client);
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

        if (this.directory) {
            let data = {
                client: values.client
            };

            this.efsTable.update({ fsid: this.fsId, directory: this.directory }, data).then(() => {
                loader.stop("success", "De wijzigingen zijn opgeslagen").then(() => this.modal.close())
            });

        } else {
            let data = {
                fsid: this.fsId,
                directory: values.name,
                client: values.client
            };

            this.efsTable.insert(data).then(() => {
                loader.stop("success", "De wijzigingen zijn opgeslagen", [ 2000, "button" ]).then(() => this.modal.close())
            });
        }
    }

}

class EFSDetailView extends ModalView {
    viewDidLoad() {
        this.domTable = new Dom.Table();
        this.domTable
            .addColumn("name", "Directory")
            .addColumn("client", "Klant")
            .addColumn("usage", "Gebruik", { content: formatFileSize })
            .addColumn("_", "_", { align: "right" });
        this.element.querySelector(".content").appendChild(this.domTable.element);

        this.ready = true;
        this.invalidated = false;
    }

    viewDidAppear() {
        this.invalidated = true;

        if (this.fsId) {
            this.element.querySelector("h2").innerHTML = this.fsName;
            if (this.ready) {
                this.refresh();
            }

        } else {
            this.element.querySelector("h2").innerHTML = "Directory toevoegen";
        }
    }

    refresh() {
        let loader = new Ux.Loader(this.element);

        this.domTable.clearRows();

        this.efsTable.findItems({ fsid: this.fsId }).then(items => {
            for (let i = 0; i < items.length; i++) {
                this.domTable.addRow({
                    name: items[i].directory,
                    client: items[i].info.client,
                    usage: items[i].info.usage||0,
                    _: `<a href="#" data-action="editDirectory(${items[i].directory})">Aanpassen <i class="material-icons">chevron_right</i></a>`
                });
                ((index, db) => {
                    this.clientsTable.getItem(db.info.client).then(client => {
                        this.domTable.getCell(index, "client").setHtml(client.info.name);
                    });
                })(i, items[i]);
            }
            this.invalidated = false;
            loader.stop();
        });
    }

    addDirectory() {
        this.editDirectory();
    }

    editDirectory(name) {
        if (!this.editView) {
            this.editView = new EFSDirectoryEditView(
                document.getElementById("efs-edit-modal"),
                { fsId: this.fsId, fsName: this.fsName, directory: name, efsTable: this.efsTable, clientsTable: this.clientsTable }
            );
            this.editView.viewWillDisappear = () => this.refresh();
        } else {
            this.editView.fsId = this.fsId;
            this.editView.fsName = this.fsName;
            this.editView.directory = name;
            this.editView.modal.open();
        }
    }
}

class EFSView extends View {
    viewDidLoad() {
        this.domTable = new Dom.Table();
        this.domTable
            .addColumn("id", "ID")
            .addColumn("name", "EFS Server")
            .addColumn("status", "Status")
            .addColumn("num_dir", "Aantal directories")
            .addColumn("usage", "Gebruik", { content: formatFileSize });
            // .addColumn("_", "_", { align: "right" });
        this.element.querySelector(".content").appendChild(this.domTable.element);

        this.invalidated = false;
        this.ready = false;

        this.efsTable.ensureExistence({ "fsid": [ "HASH", "S" ], "directory": [ "RANGE", "S" ] })
            .then(() => {
                this.ready = true;
                if (this.invalidated) {
                    this.refresh();
                } else {
                    this.invalidated = true;
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
        this.dataSource.each((fs) => {
            this.domTable.addRow({
                id: `<a href="#" data-action="showDetail(${fs.FileSystemId}, ${fs.Name})">${fs.FileSystemId}</a>`,
                name: fs.Name,
                status: fs.LifeCycleState
            }, fs.FileSystemId);
        }).then(() => {
            this.efsTable.getItems().then(items => {
                let servers = {};

                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    if (!(item.fsid in servers)) {
                        servers[item.fsid] = { numDirs: 0, usage: 0 };
                    }
                    servers[item.fsid].numDirs++;
                    if (item.info.usage) {
                        servers[item.fsid].usage += item.info.usage;
                    }
                }

                for (let name in servers) {
                    this.domTable.getCell(name, "num_dir").setHtml(servers[name].numDirs);
                    this.domTable.getCell(name, "usage").setHtml(formatFileSize(servers[name].usage));
                }

                this.invalidated = false;
            });
        });
    }

    showDetail(fsId, name) {
        if (!this.detailView) {
            this.detailView = new EFSDetailView(
                document.getElementById("efs-detail-modal"),
                { fsId: fsId, fsName: name, efsTable: this.efsTable, clientsTable: this.clientsTable }
            );
            this.detailView.viewWillDisappear = () => this.refresh();
        } else {
            this.detailView.fsId = fsId;
            this.detailView.fsName = name;
            this.detailView.modal.open();
        }
    }
}
