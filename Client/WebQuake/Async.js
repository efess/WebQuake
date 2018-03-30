var Async = {
    isPromise: function(maybePromise) {
        return maybePromise && maybePromise.then;
    },
    // loop :: (void -> truthy|falsey|{Promise}) -> {Promise} | undefined
    loop: function(fn) {
        
    },
    passThroughFn: function(fn) {
        return function(obj) {
            fn();
            return obj;
        }
    },
    maybePromise: function(maybePromiseObj, callbackFn, ctx) {
        if(maybePromiseObj && maybePromiseObj.then) {
            return maybePromiseObj.then(function(ret){ return callbackFn.call(ctx, ret); });
        } else {
            return callbackFn.call(ctx, maybePromiseObj);
        }
    }
}