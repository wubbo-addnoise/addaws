class SearchBox {
    constructor(element) {
        this.element = element;

        let selects = this.element.querySelectorAll("select");
        for (let i = 0; i < selects.length; i++) {
            selects[i].addEventListener("change", (event) => this.update());
        }
        let input = this.element.querySelector("input");
        input.addEventListener("keydown", () => input.oldValue = input.value);
        input.addEventListener("keyup", () => {
            if (input.oldValue != input.value) {
                this.update();
            }
        });

        this.finder = new Finder("https://intern.addnoise.nl/contacts/detail/searchperson/?searchterm={{query}}&orderby=&filterby={{filterby}}&operator={{operator}}&filter={{filter}}&apikey=bse4iTM2xYs6HAtUeR9dakJ2TMgnTvJx");
        this.resultsList = element.querySelector(".results-list");
        this.isUpdating = false;

        this.filter = "*";
        let tabs = this.element.querySelectorAll(".menubar .item a");
        for (let i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener("click", (event) => {
                event.preventDefault();
                this.filter = event.target.getAttribute("data-filter");
                DomUtils.activateSibling(event.target, "data-filter-group", "data-filter");
                this.update();
            });
        }

        this.resultsList.addEventListener("click", (event) => {
            event.preventDefault();
            let el = event.target;
            while (el && el != this.resultsList && !el.classList.contains("item")) {
                el = el.parentElement;
            }
            if (el && el != this.resultsList) {
                this.onSelectItem(el);
            }
        });

        if (input.value) {
            this.update();
        }
    }

    getValue(name, defaultValue) {
        defaultValue = defaultValue || null;
        let element = this.element.querySelector(`[name="${name}"]`);
        if (!element) return defaultValue;
        if (element.tagName.toLowerCase() == "SELECT") {
            if (element.selectedIndex < 0) return defaultValue;
            return element.options[element.selectedIndex].value;
        }
        return element.value;
    }

    update() {
        if (!this.isUpdating) {
            let query = this.getValue("query", "");
            if (!query) return;

            this.isUpdating = true;
            this.finder.find({
                query: query,
                filterby: this.getValue("searchfield", "*"),
                operator: this.getValue("searchoperator", "contains"),
                filter: this.filter
            }).then((result) => {
                let html = "";
                for (let i = 0; i < result.results.length; i++) {
                    let item = result.results[i];
                    html += `<div class="item" data-id="${item.id}" data-title="${item.title.replace(/"/g, '&quot;')}">
                                <div class="title">
                                    <i class="material-icons">${item.is_company ? 'business' : 'person'}</i>
                                    ${item.title}
                                </div>
                                <div class="meta">
                                    ${item.address1 ? item.address1 + '<br/>' : ""}
                                    ${item.postal ? item.postal + ', ' : ''}${item.place ? item.place : ''}${item.postal || item.place ? '<br/>' : ''}
                                    ${item.email ? item.email : ''}
                                </div>
                            </div>`;
                }
                this.resultsList.innerHTML = html;
                this.isUpdating = false;
            });
        }
    }

    onSelectItem(item){}
}

SearchBox.attach = function(element) {
    if (!("_searchBox" in element)) {
        element._searchbox = new SearchBox(element);
    }
    return element._searchbox;
};
