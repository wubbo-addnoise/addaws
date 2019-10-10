class View {
    constructor(element, data) {
        if (data) {
            for (let key in data) {
                this[key] = data[key];
            }
        }
        if (element) {
            this.setElement(element);
            this.viewDidLoad();
            if (getComputedStyle(this.element).display != "none") {
                this.viewDidAppear();
            }
        }
    }

    setElement(element) {
        this.element = element;
        this.element._view = this;
        this.element.addEventListener("click", (event) => this.onClick(event));
    }

    onClick(event) {
        let el = event.target;
        while (el && el != this.element && !el.hasAttribute("data-action")) {
            el = el.parentElement;
        }
        if (el && el != this.element) {
            event.preventDefault();
            let action = el.getAttribute("data-action");
            let m = action.match(/([^\(]+)\(([^\)]*)\)/);
            let params = [];
            if (m) {
                action = m[1];
                params = m[2].split(/\s*,\s*/);
            }
            this[action].apply(this, params);
        }
    }

    viewDidLoad(){}
    viewDidAppear(){}
    viewWillDisappear(){}
}

class ModalView extends View {
    constructor(element, data) {
        super(null, data);
        this.modal = new Modal(element);
        this.modal.onOpen = () => this.viewDidAppear();
        this.modal.onClose = () => this.viewWillDisappear();
        this.setElement(this.modal.getInnerElement());
        this.viewDidLoad();
        this.viewDidAppear();
    }
}

View.activate = function(element) {
    if ("_view" in element) {
        element._view.viewDidAppear();
    }
}
