class CloudsearchView extends View {
    viewDidLoad() {
        this.domTable = new Dom.Table();
        this.domTable
            .addColumn("name", "Domein")
            .addColumn("type", "Type")
            // .addColumn("_", "_", { align: "right" });
        this.element.querySelector(".content").appendChild(this.domTable.element);

        this.invalidated = true;
        this.ready = true;

        // this.cloudsearchTable.ensureExistence({ "fsid": [ "HASH", "S" ], "directory": [ "RANGE", "S" ] })
        //     .then(() => {
        //         this.ready = true;
        //         if (this.invalidated) {
        //             this.refresh();
        //         } else {
        //             this.invalidated = true;
        //         }
        //     })
        //     .catch((err) => {
        //         console.log(err);
        //     });
    }

    viewDidAppear() {
        if (this.invalidated && this.ready) {
            this.refresh();
        }
    }

    refresh() {
        this.domTable.clearRows();
        this.dataSource.each((domain) => {
            this.domTable.addRow({
                id: `<a href="#" data-action="showDetail(${domain.DomainId, domain.DomainName})">${domain.DomainName}</a>`,
                type: domain.SearchInstanceType
            }, fs.FileSystemId);
        }).then(() => {
            this.invalidated = false;
        });
    }

    showDetail(domainId, name) {
        // if (!this.detailView) {
        //     this.detailView = new EFSDetailView(
        //         document.getElementById("efs-detail-modal"),
        //         { fsId: fsId, fsName: name, efsTable: this.efsTable, clientsTable: this.clientsTable }
        //     );
        //     this.detailView.viewWillDisappear = () => this.refresh();
        // } else {
        //     this.detailView.fsId = fsId;
        //     this.detailView.fsName = name;
        //     this.detailView.modal.open();
        // }
    }
}
