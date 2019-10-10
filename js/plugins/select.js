function select_toggleCustomSelect(event) {
    event.preventDefault();
    if (this.parentElement.classList.contains("cs-open")) {
        this.parentElement.classList.remove("cs-open");
    } else {
        let openSelect = document.querySelector(".cs-wrapper.cs-open");
        if (openSelect) {
            openSelect.classList.remove("cs-open");
        }
        this.parentElement.classList.add("cs-open");
    }
}

function select_selectOption(event) {
    event.preventDefault();
    let option = event.target;

    if (!option.hasAttribute("data-index")) return;

    let index = parseInt(option.getAttribute("data-index"));
    let wrapper = this.parentElement.parentElement;

    let select = wrapper.querySelector("select");
    select._selectingOption = true;
    select.selectedIndex = index;
    select.dispatchEvent(new Event("change"));
    wrapper.querySelector(".cs-label").innerHTML = option.innerHTML;

    let currOption = this.querySelector(".cs-selected");
    if (currOption) {
        currOption.classList.remove("cs-selected");
    }
    option.classList.add("cs-selected");
    wrapper.classList.toggle("cs-open");
}

function select_onChange(event) {
    let select = event.target;
    if (!select._selectingOption) {
        let index = select.selectedIndex;
        let wrapper = select.parentElement;
        let optionEl = wrapper.querySelector(`[data-index="${index}"]`);
        let currOption = wrapper.querySelector(".cs-selected");
        if (currOption) currOption.classList.remove("cs-selected");
        optionEl.classList.add("cs-selected");
        let label = wrapper.querySelector(".cs-label");
        label.innerHTML = optionEl.innerHTML;
    }
    select._selectingOption = false;
}

window.Plugins.select = function(context) {
    let selects = context.querySelectorAll("select.custom-select");
    for (let i = 0; i < selects.length; i++) {
        let select = selects[i];
        let list, label;

        if ("_select" in select) {
            let wrapper = select.parentElement;
            label = wrapper.querySelector(".cs-label");
            list = wrapper.querySelector(".cs-list");
            list.innerHTML = "";
        } else {
            select._select = true;
            select._selectingOption = false;

            let wrapper = document.createElement("div");
            wrapper.className = "cs-wrapper";
            if (select.classList.contains("fullwidth")) {
                wrapper.classList.add("fullwidth");
            }
            select.parentElement.insertBefore(wrapper, select);
            wrapper.appendChild(select);

            label = document.createElement("div");
            label.className = "cs-label";
            wrapper.appendChild(label);

            let dropdown = document.createElement("div");
            dropdown.className = "cs-dropdown";
            wrapper.appendChild(dropdown);

            list = document.createElement("div");
            list.className = "cs-list";
            dropdown.appendChild(list);

            label.addEventListener("click", select_toggleCustomSelect);
            list.addEventListener("click", select_selectOption);

            select.addEventListener("change", select_onChange);
        }

        for (let o = 0; o < select.options.length; o++) {
            let option = select.options[o];
            let optEl = document.createElement("div");
            optEl.className = "cs-option";
            if (option.selected) {
                optEl.classList.add("cs-selected");
                label.innerHTML = option.innerHTML;
            }
            optEl.setAttribute("data-index", o);
            optEl.innerHTML = option.innerHTML;
            list.appendChild(optEl);
        }
    }
}

onClickOutside(
    (element) => element.classList.contains("cs-wrapper"),
    function (event) {
        let openSelect = document.querySelector(".cs-wrapper.cs-open");
        if (openSelect) {
            openSelect.classList.remove("cs-open");
        }
    }
);
