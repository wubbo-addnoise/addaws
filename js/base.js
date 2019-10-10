window.Plugins = {};
window.Ux = {};

{
    let clickOutsideListeners = [];

    window.onClickOutside = function(target, callback) {
        clickOutsideListeners.push({
            element: (target instanceof HTMLElement) ? target : null,
            check: (target instanceof Function) ? target : null,
            callback: callback
        });
    }

    window.addEventListener("click", function(event) {
        let target = event.target;

        for (let i = 0; i < clickOutsideListeners.length; i++) {
            let listener = clickOutsideListeners[i];
            let el = target;

            if (listener.element) {
                while (el && el != listener.element) {
                    el = el.parentElement;
                }
            } else if (listener.check) {
                while (el && !listener.check(el)) {
                    el = el.parentElement;
                }
            }

            if (!el) {
                if (listener.element) {
                    listener.callback.call(listener.element, event);
                } else {
                    listener.callback(event);
                }
            }
        }
    });
}
