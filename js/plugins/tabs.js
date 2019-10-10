function tabs_onTabClick(event) {
    event.preventDefault();

    DomUtils.activateSibling(this, "data-tab-group", "data-tab");

    let panel = document.querySelector(`.tabs [data-tab="${this.getAttribute('data-tab')}"]`);

    if (panel) {
        DomUtils.activateSibling(panel, "data-tab-group", "data-tab");
        View.activate(panel);
    }
}

window.Plugins.tabs = function(context) {
    let tabs = context.querySelectorAll("a[data-tab]");
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener("click", tabs_onTabClick);
    }
}
