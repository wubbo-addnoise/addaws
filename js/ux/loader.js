Ux.Loader = class UxLoader {

    constructor(element) {

        this.dimmer = document.createElement("div");
        this.dimmer.className = "loader-dimmer";

        let container = document.createElement("div");
        container.className = "loader-container";
        this.dimmer.appendChild(container);

        let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttributeNS(null, "width", "100");
        svg.setAttributeNS(null, "height", "100");
        svg.setAttributeNS(null, "viewBox", "0 0 100 100");

        this.circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        this.circle.setAttribute("cx", "50");
        this.circle.setAttribute("cy", "50");
        this.circle.setAttribute("r", "48");

        this.check = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.check.setAttribute("class", "loader-check");
        this.check.setAttribute("d", "M27.5 50l15 15l30 -30");

        this.cross = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.cross.setAttribute("class", "loader-cross");
        this.cross.setAttribute("d", "M35 35l30 30m-30 0l30 -30");

        svg.appendChild(this.circle);
        svg.appendChild(this.check);
        svg.appendChild(this.cross);
        container.appendChild(svg);

        this.message = document.createElement("div");
        this.message.className = "loader-message";
        container.appendChild(this.message);

        element.appendChild(this.dimmer);

        this.circumference = 2 * Math.PI * parseFloat(this.circle.getAttribute('r'));
        this.checkLength = 64;
        this.crossLength = 125;
        this.isStarted = false;
        this.isSpinning = false;
        this.spinInterval = null;
        this.spinT0 = 0;
        this.spinDuration = 700;

        this.start();
    }

    animate(target, pathLength, duration, startPhase) {
        return new Promise((resolve, reject) => {
            startPhase = startPhase||0;
            var multiplier = 1 - startPhase;
            var t0 = Date.now();

            var iv = setInterval(function(){
                var dt = Date.now() - t0,
                len;

                if (dt > duration) {
                    dt = duration;
                }

                len = pathLength * (startPhase + multiplier * dt / duration);

                target.setAttribute("stroke-dasharray", `${len} ${pathLength - len}`);

                if (dt >= duration) {
                    clearInterval(iv);
                    resolve();
                }
            }, 10);
        });
    }

    animateCircle() {
        this.animate(this.circle, this.circumference, 500, 0.25).then(() => {
            if (this.isSpinning) {
                this.stopSpinning();
            }
        });
    }

    animateCheck() {
        this.check.setAttribute("stroke-dashoffset", "0");
        this.animate(this.check, this.checkLength, 200);
    }

    animateCross() {
        this.cross.setAttribute("stroke-dashoffset", "0");
        this.animate(this.cross, this.crossLength, 600);
    }

    stopSpinning() {
        clearInterval(this.spinInterval);
        this.isSpinning = false;
    }

    spinCircle() {
        let doSpin = () => {
            var dt = (Date.now() - this.spinT0) % this.spinDuration;
            this.circle.setAttribute("stroke-dashoffset", -(this.circumference * dt / this.spinDuration) + 452);
        }

        if (this.isSpinning) {
            this.stopSpinning();
        } else {
            this.spinT0 = Date.now();
            this.circle.setAttribute("stroke-dasharray", (this.circumference * 0.25) + ' ' + (this.circumference * 0.75));
            this.isSpinning = true;
            this.spinInterval = setInterval(doSpin, 10);
        }
    }

    showMessage(type, text, showButton) {
        this.message.classList.remove("success");
        this.message.classList.remove("error");
        this.message.classList.add(type);
        this.message.innerHTML = text +
            (showButton
                ? `<div style="margin-top:10px;"><button class="small outline ${type} button">OK</button></div>`
                : "");
        this.message.classList.add("visible");
    }

    hideMessage() {
        this.message.classList.remove("visible");
    }

    start() {
        this.circle.setAttribute("stroke-dashoffset", "-452");
        this.circle.setAttribute("stroke-dasharray", `0 ${this.circumference}`);
        this.check.setAttribute("stroke-dasharray", `0 ${this.checkLength + 5}`);
        this.check.setAttribute("stroke-dashoffset", "5");
        this.cross.setAttribute("stroke-dasharray", `0 ${this.crossLength + 5}`);
        this.cross.setAttribute("stroke-dashoffset", "5");

        this.hideMessage();

        this.isStarted = true;

        this.dimmer.style.display = "block";
        this.dimmer.classList.remove("error");
        this.dimmer.classList.remove("success");
        setTimeout(() => {
            this.dimmer.classList.add("visible");
            setTimeout(() => {
                this.spinCircle();
            }, 200);
        }, 50);
    }

    stop(state, messageText, messageDelay) {
        return new Promise((resolve, reject) => {
            if (!this.isStarted) {
                resolve();
                return;
            }

            this.isStarted = false;

            if (!state) {
                this.dimmer.classList.remove("visible");
                resolve();
                setTimeout(() => {
                    this.stopSpinning();
                    this.dimmer.parentElement.removeChild(this.dimmer);
                }, 200);
            } else {
                messageDelay = messageDelay || 2000;

                let showButton = false;
                if (messageDelay instanceof Array) {
                    let md = -1;
                    for (let i = 0; i < messageDelay.length; i++) {
                        if (messageDelay[i] == "button") {
                            showButton = true;
                        } else {
                            md = messageDelay[i];
                        }
                    }
                    messageDelay = md;
                } else if (messageDelay == "button") {
                    showButton = true;
                    messageDelay = -1;
                }

                if (state == "error") {
                    this.dimmer.classList.remove("success");
                    this.dimmer.classList.add("error");
                } else {
                    this.dimmer.classList.remove("error");
                    this.dimmer.classList.add("success");
                }
                this.animateCircle();
                setTimeout(() => {
                    let dismissTimeout;

                    if (state == "error") {
                        this.animateCross();
                        if (messageText) this.showMessage("error", messageText, showButton);
                    } else {
                        this.animateCheck();
                        if (messageText) this.showMessage("success", messageText, showButton);
                    }

                    if (showButton) {
                        this.message.querySelector("button").addEventListener("click", (event) => {
                            if (dismissTimeout) {
                                clearTimeout(dismissTimeout);
                            }
                            this.dimmer.classList.remove("visible");
                            resolve();
                            setTimeout(() => {
                                // this.dimmer.style.display = "none";
                                this.dimmer.parentElement.removeChild(this.dimmer);
                            }, 200);
                        });
                    }

                    if (messageDelay > -1) {
                        dismissTimeout = setTimeout(() => {
                            dismissTimeout = null;
                            this.dimmer.classList.remove("visible");
                            resolve();
                            setTimeout(() => {
                                // this.dimmer.style.display = "none";
                                this.dimmer.parentElement.removeChild(this.dimmer);
                            }, 200);
                        }, messageDelay);
                    }
                }, 500);
            }
        });
    }

}
