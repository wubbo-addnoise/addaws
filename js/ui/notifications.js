class NotificationsView extends View {
    viewDidLoad() {
        this.domTable = new Dom.Table();
        this.domTable
            .addColumn("name", "Alarm")
            .addColumn("namespace", "Namespace")
            .addColumn("dim_name", "Dimension name")
            .addColumn("dim_value", "Dimension value");
            // .addColumn("domain", "Domein")
            // .addColumn("status", "Status", { content: (value) => `<span class="status ${value}"></span> ${AWSUtils.translateStatus(value)}`, nowrap: true });
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

        this.dataSource.refresh().each((alarm) => {
            this.domTable.addRow({
                name: alarm.AlarmName,
                namespace: alarm.Namespace,
                dim_name: alarm.Dimensions[0].Name,
                dim_value: alarm.Dimensions[0].Value
            });
        }).then(() => {
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
