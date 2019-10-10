window.DomUtils = {
    activateSibling: function(sibling, parentAttribute, childAttribute, childSelector, activeClass) {
        childSelector = childSelector || `${sibling.tagName.toLowerCase()}[${childAttribute}]`;
        activeClass = activeClass || "active";

        let parent = sibling.parentElement;
        while (parent && !parent.hasAttribute(parentAttribute)) {
            parent = parent.parentElement;
        }
        if (parent) {
            let children = parent.querySelectorAll(childSelector);
            for (let i = 0; i < children.length; i++) {
                if (children[i].hasAttribute(childAttribute)) {
                    if (children[i] == sibling) {
                        children[i].classList.add(activeClass);
                    } else {
                        children[i].classList.remove(activeClass);
                    }
                }
            }
        }
    },

    getFormValues: function (form) {
        let elements = form.querySelectorAll("input,textarea,select");
        let values = {};

        for (let i = 0; i < elements.length; i++) {
            let element = elements[i];
            if (!element.name) continue;
            let name = element.name.replace(/\[\]$/, '');

            if (element.tagName.toLowerCase() == "select") {
                if (element.hasAttribute("multiple")) {
                    values[name] = [];
                    for (let j = 0; j < element.options.length; j++) {
                        if (element.options[j].selected) {
                            values[name].push(element.options[j].value);
                        }
                    }
                } else {
                    values[name] = element.selectedIndex > -1 ? element.options[element.selectedIndex].value : null;
                }
            } else if (element.type == "checkbox") {
                if (element.name.match(/\[\]$/)) {
                    if (!(name in values)) values[name] = [];
                    if (element.checked) {
                        values[name].push(element.value);
                    }
                } else if (element.checked) {
                    values[name] = element.value;
                } else {
                    values[name] = null;
                }
            } else if (element.type == "radio") {
                if (element.checked) {
                    values[name] = element.value;
                } else if (!(name in values)) {
                    values[name] = null;
                }
            } else {
                values[name] = element.value;
            }
        }

        return values;
    }
};

DomUtils.FormField = class DomUtilsFormField {
    constructor(elements) {
        this.elements = elements;
        this.element = elements.length > 0 ? elements[0] : null;
        this.type = "text";
        if (this.element) {
            if (this.element.tagName.toLowerCase() == "select") {
                this.type = this.element.hasAttribute("multiple") ? "multiselect" : "select";
            } else if (this.element.type == "checkbox") {
                this.type = this.elements.length > 1 ? "multicheckbox" : "checkbox";
            } else if (this.element.type == "radio") {
                this.type = "radio";
            }
        } else {
            console.warn("No form field found");
        }
    }

    focus() {
        this.element.focus();
    }

    getValue() {
        if (!this.element) return null;
        let value;
        switch (this.type) {
            case "select":
                return this.element.selectedIndex > -1 ? this.element.options[this.element.selectedIndex].value : null;
            case "multiselect":
                value = [];
                for (let i = 0; i < this.element.options.length; i++) {
                    if (this.element.options[i].select) value.push(this.elements[i].value);
                }
                return value;
            case "checkbox":
                return this.element.checked ? this.element.value : false;
            case "multicheckbox":
                value = [];
                for (let i = 0; i < this.elements.length; i++) {
                    if (this.elements[i].checked) value.push(this.elements[i].value);
                }
                return value;
            case "radio":
                for (let i = 0; i < this.elements.length; i++) {
                    if (this.elements[i].checked) return this.elements[i].value;
                }
                return null;
            default:
                return this.element.value;
        }
    }

    setValue(value) {
        if (!this.element) return;
        switch (this.type) {
            case "select":
                for (let i = 0; i < this.element.options.length; i++) {
                    if (this.element.options[i].value == value) {
                        this.element.selectedIndex = i;
                        break;
                    }
                }
                this.element.dispatchEvent(new Event("change"));
                break;
            case "multiselect":
                if (!(value instanceof Array)) value = [ value ];
                for (let i = 0; i < this.element.options.length; i++) {
                    this.element.options[i].selected = (value.indexOf(this.element.options[i].value) > -1);
                }
                break;
            case "checkbox":
                this.element.checked = value == this.element.value || value === true;
                break;
            case "multicheckbox":
                if (!(value instanceof Array)) value = [ value ];
                for (let i = 0; i < this.elements.length; i++) {
                    this.elements[i].selected = (value.indexOf(this.elements[i].value) > -1);
                }
                break;
            case "radio":
                for (let i = 0; i < this.elements.length; i++) {
                    this.elements[i].checked = this.elements[i].value == value;
                }
                break;
            default:
                this.element.value = value;
                break;
        }
    }

    clearValue() {
        if (!this.element) return;
        switch (this.type) {
            case "select":
                this.element.selectedIndex = 0;
                for (let i = 0; i < this.element.options.length; i++) {
                    if (this.element.options[i].hasAttribute("selected")) {
                        this.element.selectedIndex = i;
                        break;
                    }
                }
                this.element.dispatchEvent(new Event("change"));
                break;
            case "multiselect":
                if (!(value instanceof Array)) value = [ value ];
                for (let i = 0; i < this.element.options.length; i++) {
                    this.element.options[i].selected = this.element.options[i].hasAttribute("selected");
                }
                break;
            case "checkbox":
                this.element.checked = this.element.hasAttribute("checked");
                break;
            case "multicheckbox":
                if (!(value instanceof Array)) value = [ value ];
                for (let i = 0; i < this.elements.length; i++) {
                    this.elements[i].selected = this.element.options[i].hasAttribute("checked");
                }
                break;
            case "radio":
                for (let i = 0; i < this.elements.length; i++) {
                    this.elements[i].checked = this.element.options[i].hasAttribute("checked");
                }
                break;
            default:
                this.element.value = this.element.getAttribute("value") || "";
                break;
        }
    }

    setOptions(options) {
        let currValue = this.getValue();
        this.clearOptions();
        for (let key in options) {
            this.addOption(key, options[key], (currValue instanceof Array) ? currValue.indexOf(key) > -1 : key == currValue);
        }
    }

    clearOptions() {
        switch (this.type) {
            case "select":
                this.element.innerHTML = "";
                break;
        }
    }

    addOption(value, label, selected) {
        switch (this.type) {
            case "select":
                let option = document.createElement("option");
                option.value = value;
                option.innerHTML = label;
                option.selected = selected;
                this.element.appendChild(option);
                break;
        }
    }
}

class Int_Condition {
    constructor(leftHand, operator, rightHand) {
        this.parent = null;
        this.leftHand = leftHand;
        this.operator = operator == '=' ? '==' : operator;
        this.rightHand = rightHand;

        if (!operator) {
            let m = leftHand.match(/==|=|!=|<=|>=|<|>|in|contains/);
            if (m) {
                this.operator = m[0] == '=' ? '==' : m[0];
                this.rightHand = leftHand.substring(m.index + m[0].length).replace(/^\s+/, '');
                this.leftHand = this.leftHand.substring(0, m.index).replace(/\s+$/, '');
            }
        }
    }

    toString() {
        let str = `${this.leftHand}${this.operator ? ' ' + this.operator + ' ' + this.rightHand : ''}`;
        if (this.operator == "in") {
            str = `${this.rightHand}.indexOf(${this.leftHand}) > -1`;
        } else if (this.operator == "contains") {
            str = `${this.leftHand}.indexOf(${this.rightHand}) > -1`;
        }
        return str;
    }

    check(value) {
        let str = `value${this.operator ? ' ' + this.operator + ' ' + this.rightHand : ''}`;
        if (this.operator == "in") {
            str = `${this.rightHand}.indexOf(value) > -1`;
        } else if (this.operator == "contains") {
            str = `value.indexOf(${this.rightHand}) > -1`;
        }
        return eval(str);
    }
}

class Int_Conditions {
    constructor(glue) {
        this.parent = null;
        this.glue = glue;
        this.conditions = [];
    }

    addCondition(cond) {
        cond.parent = this;
        this.conditions.push(cond);
    }

    toString() {
        let str = this.conditions.join(` ${this.glue == 'and' ? '&&' : '||'} `);
        if (this.parent) {
            str = `(${str})`;
        }
        return str;
    }
}

DomUtils.Form = class DomUtilsForm {
    constructor(element) {
        this.element = element;
        this.fields = {};
        this.conditionalElements = this.element.querySelectorAll('[data-show-when],[data-focus-when]');
        if (this.conditionalElements.length > 0) {
            for (let i = 0; i < this.conditionalElements.length; i++) {
                let el = this.conditionalElements[i];
                el._checkFor = [];
                if (el.hasAttribute("data-show-when")) el._checkFor.push("show");
                if (el.hasAttribute("data-focus-when")) el._checkFor.push("focus");
            }
            this.element.addEventListener("change", this.onChange.bind(this), true);
            this.onChange();
        }
    }

    getField(name) {
        if (!(name in this.fields)) {
            this.fields[name] = new DomUtils.FormField(this.element.querySelectorAll(`[name="${name}"]`));
        }
        return this.fields[name];
    }

    getValues() {
        return DomUtils.getFormValues(this.element);
    }

    clearValues() {
        let fields = this.element.querySelectorAll('input[name],textarea[name],select[name]');
        for (let i = 0; i < fields.length; i++) {
            this.getField(fields[i].name).clearValue();
        }
    }

    compileCondition(condition) {
        let cond = condition;
        let top = new Int_Conditions("and");
        let root = top;

        while (true) {
            let m = cond.match(/==|=|!=|<=|>=|<|>|in|contains|&&|\|\||and|or|\(|\)/);
            if (!m) break;

            let prefix = null;
            if (m.index > 0) {
                prefix = cond.substring(0, m.index).replace(/^\s+|\s+$/g, '');
            }

            cond = cond.substring(m.index + m[0].length);

            if (m[0] == "&&" || m[0] == "and") {
                if (prefix) {
                    top.addCondition(new Int_Condition(prefix));
                }
                top.glue = "and";
            } else if (m[0] == "||" || m[0] == "or") {
                if (prefix) {
                    top.addCondition(new Int_Condition(prefix));
                }
                top.glue = "or";
            } else if (m[0] == "(") {
                if (prefix) {
                    top.addCondition(new Int_Condition(prefix));
                }
                let c = new Int_Conditions("and");
                top.addCondition(c);
                top = c;
            } else if (m[0] == ")") {
                if (prefix) {
                    top.addCondition(new Int_Condition(prefix));
                }
                top = top.parent;
            } else {
                if (!prefix) {
                    throw "Invalid expression: " + condition;
                }

                let mExpr = cond.match(/true|false|null|(\d*\.?\d+)|(\"([^\\\\\"]*(\\\\.)?)+\")|('([^\\\\']*(\\\\.)?)+')|[a-zA-Z][a-zA-Z0-9]*/);

                let rightHand;

                if (mExpr) {
                    if (mExpr[0] == "and" || mExpr[0] == "or") {
                        throw "Unexpected " + mExpr[0];
                    }
                    rightHand = mExpr[0];
                    if (rightHand.match(/^[a-zA-Z]/)) {
                        rightHand = `values.${rightHand}`;
                    }
                    cond = cond.substring(mExpr.index + mExpr[0].length);
                } else {
                    throw "Expected expression";
                }

                rightHand = rightHand.replace(/^\s+|\s+$/g, '');
                top.addCondition(new Int_Condition(`values.${prefix}`, m[0], rightHand));
            }
        }

        return new Function("values", `return ${root.toString()};`);
    }

    onChange(event) {
        // if (event && (!event.target.name || this.conditionFields.indexOf(event.target.name) == -1)) return;

        let values = this.getValues();
        for (let i = 0; i < this.conditionalElements.length; i++) {
            let element = this.conditionalElements[i];

            for (let j = 0; j < element._checkFor.length; j++) {
                switch (element._checkFor[j]) {
                    case "show":
                        if (!("_checkCondition" in element)) {
                            element._checkCondition = this.compileCondition(element.getAttribute("data-show-when"));
                            element._originalDisplay = getComputedStyle(element).display || "block";
                        }
                        element.style.display = element._checkCondition(values) ? element._originalDisplay : "none";
                        break;

                    case "focus":
                        if (event) {
                            if (!("_checkFocus" in element)) {
                                element._checkFocus = new Int_Condition(element.getAttribute("data-focus-when"));
                            }
                            if (element._checkFocus.leftHand == event.target.name && element._checkFocus.check(this.getField(event.target.name).getValue())) {
                                element.focus();
                            }
                        }
                        break;
                }
            }
        }
    }
}

window.Dom = {};

Dom.TableCell = class DomTableCell {
    constructor(element) {
        this.element = element;
    }

    setHtml(html) {
        this.element.innerHTML = html;
    }
}

Dom.Table = class DomTable {
    constructor() {
        this.element = document.createElement("table");
        this.element.className = "table striped";
        this.thead = document.createElement("thead");
        this.thead.innerHTML = "<tr></tr>";
        this.element.appendChild(this.thead);
        this.tbody = document.createElement("tbody");
        this.element.appendChild(this.tbody);
        this.columns = {};
    }

    addColumn(key, caption, options) {
        let index = Object.keys(this.columns).length;
        this.columns[key] = { index: index, options: options||{} };
        let th = document.createElement("th");
        th.innerHTML = caption == "_" ? "&nbsp;" : caption;
        this.thead.querySelector("tr").appendChild(th);
        return this;
    }

    setRows(rows) {
        this.clearRows();
        for (let i = 0; i < rows.length; i++) {
            this.addRow(rows[i]);
        }
    }

    addRow(row, name) {
        let tr = document.createElement("tr");
        if (name) {
            tr.setAttribute('data-name', name);
        }
        let columns = [];
        for (let key in row) {
            if (!(key in this.columns)) continue;
            let html = row[key];
            let column = this.columns[key];
            if ("content" in column.options) {
                html = column.options.content(html);
            }
            let classes = [];
            if (column.options.align) classes.push(column.options.align + " aligned");
            if (column.options.nowrap) classes.push("nowrap");
            columns[column.index] = `<td${classes.length > 0 ? ' class="' + classes.join(" ") + '"' : ''}>${html}</td>`;
        }
        let maxIndex = Object.keys(this.columns).length;
        for (let i = 0; i < maxIndex; i++) {
            if (!columns[i]) {
                columns[i] = '<td>&nbsp;</td>';
            }
        }
        tr.innerHTML = columns.join("");
        this.tbody.appendChild(tr);
    }

    clearRows() {
        this.tbody.innerHTML = "";
    }

    getCell(row, column) {
        if (typeof column == "string") {
            if (!(column in this.columns)) return null;
            column = this.columns[column].index;
        }
        let td;
        if (typeof row == "string") {
            td = this.tbody.querySelector(`tr[data-name="${row}"] td:nth-child(${column + 1})`);
        } else {
            td = this.tbody.querySelector(`tr:nth-child(${row + 1}) td:nth-child(${column + 1})`);
        }
        if (!td) return null;
        return new Dom.TableCell(td);
    }
}
