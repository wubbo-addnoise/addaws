let ModalEngine = {
    modals: [],

    addModal: function(modal) {
        this.ensureDimmer();
        this.showDimmer(this.modals.length).then(() => {
            this.modals.push(modal);
            modal.wrapper.style.zIndex = this.modals.length * 10;
            this.container.appendChild(modal.wrapper);
            setTimeout(() => {
                modal.wrapper.classList.add("visible");
            }, 100);
        });
    },

    removeModal: function(modal) {
        let index = this.modals.indexOf(modal);
        if (index == -1) return;
        for (let i = index; i < this.modals.length; i++) {
            this.modals[i].wrapper.classList.remove("visible");
        }

        setTimeout(() => {
            for (let i = index; i < this.modals.length; i++) {
                if (this.modals[i].originalParent) {
                    this.modals[i].originalParent.insertBefore(this.modals[i].element, this.modals[i].originalSibling);
                }
                this.container.removeChild(this.modals[i].wrapper);
            }
            this.modals.splice(index);
        }, 300);
        setTimeout(() => {
            this.showDimmer(index - 1);
        }, 150);
    },

    ensureDimmer: function() {
        if (!this.container) {
            this.container = document.createElement("div");
            this.container.className = "modal-container";
            document.body.appendChild(this.container);
            this.container.addEventListener("click", function(event){
                let el = event.target;
                while (el && !el.classList.contains("modal-inner")) {
                    el = el.parentElement;
                }
                if (!el) {
                    event.preventDefault();
                    ModalEngine.removeModal(ModalEngine.modals[ModalEngine.modals.length - 1]);
                }
            });
        }
        if (!this.dimmer) {
            this.dimmer = document.createElement("div");
            this.dimmer.className = "modal-dimmer";
            this.container.appendChild(this.dimmer);
        }
    },

    showDimmer: function(index) {
        return new Promise((resolve, reject) => {
            if (index < 0) {
                this.dimmer.classList.remove("visible");
                this.container.classList.remove("visible");
                setTimeout(() => {
                    this.container.style.display = "none";
                    resolve();
                }, 300);
            } else {
                if (getComputedStyle(this.container).display == "none") {
                    this.container.style.display = "block";
                    setTimeout(() => {
                        this.dimmer.style.zIndex = index * 10 + 5;
                        this.container.classList.add("visible");
                        this.dimmer.classList.add("visible");
                        resolve();
                    }, 100);
                } else {
                    this.dimmer.style.zIndex = index * 10 + 5;
                    this.container.classList.add("visible");
                    this.dimmer.classList.add("visible");
                    resolve();
                }
            }
        });
    }
};

class Modal {
    constructor(element) {
        if (!element) {
            element = document.createElement("div");
            element.className = "modal";
            element.innerHTML = '<div class="modal-inner"><div class="progress-circle centered indeterminate"></div></div>';
        }

        this.element = element;
        this.closeButton = this.element.querySelector(".close-button");
        if (!this.closeButton) {
            this.closeButton = document.createElement("button");
            this.closeButton.className = "close-button";
            this.closeButton.setAttribute("title", "Sluiten");
            this.closeButton.innerHTML = '<i class="material-icons">close</i>';
            let innerElement = this.getInnerElement();
            if (innerElement) {
                innerElement.appendChild(this.closeButton);
            }
        }

        this.originalParent = null;
        this.originalSibling = null;
        if (this.element.parentElement) {
            this.originalParent = this.element.parentElement;
            this.originalSibling = this.element.nextElementSibling;
        }

        this.wrapper = document.createElement("div");
        this.wrapper.className = "modal-wrapper";

        this.element.addEventListener("click", this.onClick.bind(this));


        this.open();
    }

    close() {
        ModalEngine.removeModal(this);
        this.onClose();
    }

    open() {
        this.wrapper.appendChild(this.element);
        ModalEngine.addModal(this);
        this.onOpen();
    }

    getInnerElement() {
        return this.element.querySelector(".modal-inner");
    }

    onClick(event) {
        let el = event.target;
        if (el && (el.classList.contains("close-button") || el.parentElement.classList.contains("close-button"))) {
            event.preventDefault();
            this.close();
        }
    }

    onOpen(){}
    onClose(){}
}

Modal.confirm = function(message) {
    return new Promise((resolve, reject) => {
        let html = message;
        html += '<div class="buttons">';
        html += '<button type="button" class="ok button">OK</button>';
        html += '<button type="button" class="cancel button outline">Annuleren</button>';
        html += '</div>';

        let modal = new Modal();
        let el = modal.getInnerElement();
        el.innerHTML = html;
        el.querySelector(".ok.button").addEventListener("click", (event) => {
            event.preventDefault();
            modal.close();
            resolve(true);
        });
        el.querySelector(".cancel.button").addEventListener("click", (event) => {
            event.preventDefault();
            modal.close();
            resolve(false);
        });
    });
};
