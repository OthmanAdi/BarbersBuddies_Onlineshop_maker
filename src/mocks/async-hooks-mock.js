class AsyncLocalStorage {
    constructor() {
        this.store = new Map();
    }

    run(store, callback) {
        return callback();
    }

    getStore() {
        return null;
    }
}

module.exports = {
    AsyncLocalStorage
};