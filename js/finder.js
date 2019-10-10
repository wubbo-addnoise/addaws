class Finder {
    constructor(url) {
        this.url = url;
        this.cache = {};
    }

    find(params) {
        return new Promise((resolve, reject) => {
            let url = this.url;
            for (let key in params) {
                url = url.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), encodeURIComponent(params[key]));
            }

            function doResolve(response) {
                if (typeof response == "string" && (response[0] == '{' || response[0] == '[')) {
                    response = JSON.parse(response);
                }
                resolve(response);
            }

            if (url in this.cache) {
                doResolve(this.cache[url]);
            } else {
                let xhr = new XMLHttpRequest();
                xhr.addEventListener("readystatechange", () => {
                    if (xhr.readyState == 4) {
                        if (Math.floor(xhr.status / 100) == 2) {
                            this.cache[url] = xhr.response;
                            doResolve(this.cache[url]);
                        }
                    }
                });
                xhr.open("GET", url, true);
                xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
                xhr.send();
            }
        });
    }
}
