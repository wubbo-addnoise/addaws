/* AWS */
AWS.config.region = 'eu-west-1'; // Region
AWS.config.update(AwsConfig);
// AWS.config.credentials = new AWS.CognitoIdentityCredentials(AwsCognito);
// AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    // IdentityPoolId: 'eu-west-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    // IdentityId: 'eu-west-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
// }, { region: "eu-west-1" });

let AWSUtils = {
    getTag: function(resource, key, defaultValue) {
        defaultValue = defaultValue || null;
        if (!("Tags" in resource)) return defaultValue;
        for (let i = 0; i < resource.Tags.length; i++) {
            if (resource.Tags[i].Key == key) {
                return resource.Tags[i].Value || defaultValue;
            }
        }
        return defaultValue;
    },

    translateStatus: function(status) {
        switch (status) {
            case "running":
                return "Draaiend";
            case "paused":
                return "Gepauzeerd";
            case "stopped":
                return "Gestopt";
            case "terminated":
                return "Getermineerd";
        }
        return status;
    }
};

class DBTable {
    constructor(name, options) {
        this.name = name;
        this.docClient = new AWS.DynamoDB.DocumentClient();
        this.cache = {};
        this.defaultSort = null;

        if (options && ("defaultSort" in options)) {
            this.defaultSort = options.defaultSort;
        }
    }

    storeCache(item) {
        let key = this.pkey.map(k => k + ':' + item[k]).join(',');
        this.cache[key] = item;
    }

    getCache(uid) {
        let key = this.pkey.map(k => k + ':' + uid[k]).join(',');
        return (key in this.cache) ? this.cache[key] : null;
    }

    deleteCache(uid) {
        let key = this.pkey.map(k => k + ':' + uid[k]).join(',');
        if (key in this.cache) {
            delete this.cache[key];
        }
    }

    sortItems(items) {
        if (!this.defaultSort) return;
        let key = this.defaultSort;
        if (key.match(/\/i$/)) {
            key = key.replace(/\/i$/, '');
            items.sort((a, b) => a[key].toLowerCase() == b[key].toLowerCase() ? 0 : a[key].toLowerCase() < b[key].toLowerCase() ? -1 : 1);
        } else {
            items.sort((a, b) => a[key] == b[key] ? 0 : a[key] < b[key] ? -1 : 1);
        }
    }

    getItems() {
        return new Promise((resolve, reject) => {
            let params = {
                TableName: this.name
            };
            this.docClient.scan(params, (err, data) => {
                if (err) {
                    console.log(err);
                    reject(err);
                    return;
                }
                for (let i = 0; i < data.Items.length; i++) {
                    this.storeCache(data.Items[i]);
                }
                this.sortItems(data.Items);
                resolve(data.Items);
            });
        });
    }

    findItems(query) {
        return new Promise((resolve, reject) => {
            let queryString = "",
                attrNames = {},
                attrValues = {};

            for (let key in query) {
                if (queryString) queryString += " and ";
                queryString += `#${key} = :${key}`;
                attrNames[`#${key}`] = key;
                attrValues[`:${key}`] = query[key];
            }

            let params = {
                TableName: this.name,
                KeyConditionExpression: queryString,
                ExpressionAttributeNames: attrNames,
                ExpressionAttributeValues: attrValues,
            };

            this.docClient.query(params, (err, data) => {
                if (err) {
                    console.log(err);
                    reject(err);
                    return;
                }
                for (let i = 0; i < data.Items.length; i++) {
                    this.storeCache(data.Items[i]);
                }
                this.sortItems(data.Items);
                resolve(data.Items);
            });
        });
    }

    getItem(uid) {
        return new Promise((resolve, reject) => {
            if (typeof uid != "object") {
                uid = { uid: uid };
            }

            let cache = this.getCache(uid);
            if (cache) {
                resolve(cache);
                return;
            }

            let params = {
                TableName: this.name,
                Key: uid
            };
            this.docClient.get(params, (err, data) => {
                if (err) {
                    console.log(err);
                    reject(err);
                    return;
                }
                if (!data.Item) {
                    reject();
                    return;
                }
                resolve(data.Item);
            });
        });
    }

    insert(data) {
        return new Promise((resolve, reject) => {
            let item = { ...data };

            let params = {
                TableName: this.name,
                Item: item
            };

            this.docClient.put(params, (err, data) => {
                if (err) {
                    console.log(err);
                    return;
                }
                this.storeCache(item);
                resolve();
            });
        });
    }

    update(uid, data) {
        return new Promise((resolve, reject) => {
            let updExpr = "";
            let attrNames = {};
            let attrValues = {};

            let c = 1;
            for (let key in data) {
                updExpr += `${updExpr ? ", " : "set "}#a${c} = :a${c}`;
                attrNames[`#a${c}`] = key;
                attrValues[`:a${c}`] = data[key];
                c++;
            }

            if (typeof uid != "object") {
                uid = { uid: uid };
            }

            let params = {
                TableName: this.name,
                Key: uid,
                UpdateExpression: updExpr,
                ExpressionAttributeNames: attrNames,
                ExpressionAttributeValues: attrValues,
                ReturnValues: "UPDATED_NEW"
            };

            this.docClient.update(params, (err, data) => {
                if (err) {
                    console.log(err);
                    return;
                }

                let item = {};
                for (let key in uid) item[key] = uid[key];
                item.data = {};
                for (let key in data) item.data[key] = data[key];
                this.storeCache(item);

                resolve();
            });
        });
    }

    delete(uid) {
        return new Promise((resolve, reject) => {
            if (typeof uid != "object") {
                uid = { uid: uid };
            }

            let params = {
                TableName: this.name,
                Key: uid
            };
            this.docClient.delete(params, (err, data) => {
                if (err) {
                    console.log(err);
                    return;
                }
                this.deleteCache(uid);
                resolve();
            });
        });
    }

    ensureExistence(pkType) {
        // return DBTable.ensure(this.name, pkType);
        return new Promise((resolve, reject) => {
            let db = new AWS.DynamoDB();
            pkType = pkType || "N";
            db.describeTable({ TableName: this.name }, (err, data) => {
                if (err) {
                    if (err.name == "ResourceNotFoundException") {
                        let params = {
                            TableName : this.name,
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 5,
                                WriteCapacityUnits: 5
                            }
                        };

                        if (typeof pkType == "object") {
                            params.KeySchema = [];
                            params.AttributeDefinitions = [];
                            this.pkey = [];
                            for (let key in pkType) {
                                params.KeySchema.push({ AttributeName: key, KeyType: pkType[key][0] });
                                params.AttributeDefinitions.push({ AttributeName: key, AttributeType: pkType[key][1] });
                                this.pkey.push(key);
                            }
                        } else {
                            this.pkey = [ "uid" ];
                            params.KeySchema = [
                                { AttributeName: "uid", KeyType: "HASH" }
                            ];
                            params.AttributeDefinitions = [
                                { AttributeName: "uid", AttributeType: pkType }
                            ];
                        }

                        db.createTable(params, function(err, data) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    } else {
                        reject(err);
                    }
                } else {
                    this.pkey = data.Table.KeySchema.map(schema => schema.AttributeName);
                    resolve();
                }
            });
        });
    }
}

class DataSource {
    constructor() {
        this.items = null;
        this.isFetching = false;
        this.queue = [];
    }

    fetch() {
        return new Promise((resolve, reject) => {
            this.items = [];
            resolve();
        });
    }

    refresh() {
        this.items = null;
        return this;
    }

    each(callback) {
        return new Promise((resolve, reject) => {
            let run = () => {
                this.isFetching = false;
                for (let i = 0; i < this.items.length; i++) {
                    if (callback(this.items[i], i) === false) break;
                }
                resolve();
            }

            if (!this.items) {
                if (!this.isFetching) {
                    this.isFetching = true;
                    this.fetch().then(() => {
                        run();
                        if (this.queue.length > 0) {
                            for (let i = 0; i < this.queue.length; i++) {
                                this.queue[i]();
                            }
                            this.queue = [];
                        }
                    });
                } else {
                    this.queue.push(run);
                }
            } else {
                run();
            }
        });
    }

    itemMatches(item, selector) {
        return false;
    }

    get(selector) {
        return new Promise((resolve, reject) => {
            let matchingItem = null;
            this.each((item) => {
                if (this.itemMatches(item, selector)) {
                    matchingItem = item;
                    return false;
                }
            }).then(() => resolve(matchingItem));
        });
    }

    filter(filterFunc) {
        return new Promise((resolve, reject) => {
            let items = [];
            this.each((item) => {
                if (filterFunc(item)) {
                    items.push(item);
                }
            }).then(() => {
                resolve(items);
            });
        });
    }

    invalidate() {
        this.items = null;
    }
}

class DataSourceEC2 extends DataSource {
    constructor() {
        super();
        this.ec2 = new AWS.EC2();
    }

    fetch() {
        return new Promise((resolve, reject) => {
            this.ec2.describeInstances({}, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.items = [];
                for (let i = 0; i < data.Reservations.length; i++) {
                    for (let j = 0; j < data.Reservations[i].Instances.length; j++) {
                        this.items.push(data.Reservations[i].Instances[j]);
                    }
                }
                resolve();
            });
        });
    }

    itemMatches(item, selector) {
        return item.InstanceId == selector;
    }
}

class DataSourceEFS extends DataSource {
    constructor() {
        super();
        this.efs = new AWS.EFS();
    }

    fetch() {
        return new Promise((resolve, reject) => {
            this.efs.describeFileSystems({}, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.items = data.FileSystems;
                resolve();
            });
        });
    }

    itemMatches(item, selector) {
        return item.DBInstanceName == selector;
    }
}

class DataSourceRDS extends DataSource {
    constructor() {
        super();
        this.rds = new AWS.RDS();
    }

    fetch() {
        return new Promise((resolve, reject) => {
            this.rds.describeDBInstances({}, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.items = data.DBInstances;
                resolve();
            });
        });
    }

    itemMatches(item, selector) {
        return item.FileSystemId == selector;
    }
}

class DataSourceCloudsearch extends DataSource {
    constructor() {
        super();
        this.cloudsearch = new AWS.CloudSearch();
    }

    fetch() {
        return new Promise((resolve, reject) => {
            this.cloudsearch.describeDomains({}, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.items = data.DomainStatusList;
                resolve();
            });
        });
    }

    itemMatches(item, selector) {
        return item.DomainId == selector;
    }
}

class DataSourceList extends DataSource {
    constructor(items, selectorKeyPath) {
        super();
        this.items = items;
        this.selectorKeyPath = selectorKeyPath;
    }

    itemMatches(item, selector) {
        return item[this.selectorKeyPath] == selector;
    }
}
