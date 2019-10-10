class Path {
    constructor() {
        this.commands = [];
    }

    moveTo(x, y) {
        this.commands.push(new Path.MoveTo(x, y, false));
        return this;
    }

    moveToRel(x, y) {
        this.commands.push(new Path.MoveTo(x, y, true));
        return this;
    }

    lineTo(x, y) {
        this.commands.push(new Path.LineTo(x, y, false));
        return this;
    }

    lineToRel(x, y) {
        this.commands.push(new Path.LineTo(x, y, true));
        return this;
    }

    closePath() {
        this.commands.push(new Path.ClosePath());
        return this;
    }

    getSvgString() {
        let svg = "";
        for (let i = 0; i < this.commands.length; i++) {
            svg += this.commands[i].getSvgString();
        }
        return svg;
    }
}

Path.MoveTo = class PathMoveTo {
    constructor(x, y, rel) {
        this.x = x;
        this.y = y;
        this.rel = rel;
    }

    getSvgString() {
        return `${this.rel ? "m" : "M"}${this.x}${this.y >= 0 ? " " : ""}${this.y}`;
    }
}

Path.LineTo = class PathLineTo {
    constructor(x, y, rel) {
        this.x = x;
        this.y = y;
        this.rel = rel;
    }

    getSvgString() {
        return `${this.rel ? "l" : "L"}${this.x}${this.y >= 0 ? " " : ""}${this.y}`;
    }
}

Path.ClosePath = class PathClosePath {
    getSvgString() {
        return "Z";
    }
}

let path = new Path();
path
    .moveTo(10, 10)
    .lineToRel(4, 4)
    .closePath();

console.log(path.commands);
console.log(path.getSvgString());
