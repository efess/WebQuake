Func = {
    curry: function(fn) {
        var fnArity = fn.length;
        var f = function(args) {
            return function () {
                var newArgs = (args || []).concat([].slice.call(arguments, 0));
                if (newArgs.length >= fnArity) {
                    return fn.apply(this, newArgs);
                }
                else {return f(newArgs);}
            };
        };

        return f([]);
     },
     always: function(x) {
         return function() { return x; };
     }
};