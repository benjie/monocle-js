Monocle.js
==========

Monocle.js is a Node library for using a blocking-like syntax when writing
asynchronous code. In other words, it's one way to avoid the 'callback hell' so
many Javascript developers love to hate. It's a port of the
[Monocle](https://github.com/saucelabs/monocle) library for event-driven
Python, made possible by ES6's new generators and the `yield` keyword.

Install with: `npm install monocle.js`

The problem
-----------
A lot of Node libraries and Javascript libraries in general follow the callback
pattern. This isn't bad in and of itself but it encourages developers to write
code that drifts rightward and becomes difficult to read. Let's say we want to
read some data from the web and write it to a file:

```js
var request = require('request')
  , fs = require('fs');

var myLibraryFunction = function(jsonUrl, cb) {
    request(jsonUrl, function(err, resp, body) {
        if (err) {
            return cb(err);
        }
        fs.writeFile('/path/to/my/file.json', body, function(err) {
            if (err) {
                return cb(err);
            }
            cb(null, resp, body);
        });
    });
};

myLibraryFunction('http://somesite.com/json/data', function(err, resp, body) {
    if (err) {
        console.log("Downloading and writing file failed!");
    } else {
        console.log("Downloading and writing file was successful!");
        console.log(resp);
        console.log(body);
    }
};
```

This is obviously a contrived example, but when building up a library of
project-speciic functionality, you often find yourself doing this in Node.

Here's what the same code could look like using Monocle:

```js
var request = require('monocle-request')
  , fs = require('monocle-fs')
  , monocle = require('monocle.js')
  , o_O = monocle.o_O;

var myLibraryFunction = o_O(function*(jsonUrl) {
    var data = yield request(jsonUrl);
    yield fs.writeFile('/path/to/my/file.json', data[1]);
    return data;
});

var main = o_O(function*() {
    try {
        var data = yield myLibraryFunction('http://somesite.com/json/data');
        console.log("Downloading and writing file was successful!");
        console.log(data[0]);
        console.log(data[1]);
    } catch (err) {
        console.log("Downloading and writing file failed!");
    }
});

monocle.launch(main);
```

As you can see, the points at which you would have created an anonymous
function to handle the asynchronous callback, you now simply use the `yield`
keyword to block until the callback's result is ready. And the library
functions you create are 'monoclized' by wrapping them (or 'decorating them')
with the `o_O` method.

Also, notice that you don't need to do any explicit error handling if you don't
want to. Errors will be thrown like synchronous JS code, and can be caught and
handled appropriately.

It's important to understand that Monocle methods cannot simply be called like
normal functions--to actually begin executing them, pass them as arguments to
`monocle.launch`. There's also a convenience method for launching a monoclized
generator directly: `monocle.run`. With `monocle.run`, you can avoid having to
define a `main` function in the example above, like so:

```js
monocle.run(function*() {
    try {
        var data = yield myLibraryFunction('http://somesite.com/json/data');
        console.log("Downloading and writing file was successful!");
        console.log(data[0]);
        console.log(data[1]);
    } catch (err) {
        console.log("Downloading and writing file failed!");
    }
});
```

Using callback-based methods
--------------------
Of course, in the previous examples, I've required `monocle-fs` and
`monocle-request`, libraries which didn't exist until I created them. What if
you want to make use of arbitrary callback-based library methods? You can do
that with Monocle as well. Here's the previous example without the assumption
that `request` and `fs` have already been 'monoclized'.

```js
var request = require('request')
  , fs = require('fs')
  , monocle = require('monocle.js')
  , o_O = monocle.o_O;
  , o_C = monocle.callback;

var myLibraryFunction = o_O(function*(jsonUrl) {
    var cb = o_C();
    request(jsonUrl, cb);
    var data = yield cb;
    cb = o_C();
    fs.writeFile('/path/to/my/file.json', data[1], cb);
    yield cb;
    return data;
});

monocle.run(function*() {
    try {
        var data = yield myLibraryFunction('http://somesite.com/json/data');
        console.log("Downloading and writing file was successful!");
        console.log(data[0]);
        console.log(data[1]);
    } catch (err) {
        console.log("Downloading and writing file failed!");
    }
});
```

The way it works is that first we create a special callback to be used in the
library method. We do this by calling `monocle.callback()` or `monocle.o_C()`
for short. This creates a callback we pass to the asynchronous method. Then, on
the next line, we simply `yield` to the callback, which blocks execution until
the asynchronous method is done and we have a result. Using this strategy, it's
easy to incorporate library methods which have not yet been monoclized.

Functions which have been monoclized are called 'o-routines', and, from within
other o-routines, can simply be yielded to without creating a callback. This is
why we simply `yield myLibraryFunction(jsonUrl)` in the example above.

Yield! As in traffic
-------------------
Reading through the examples above, you may have noticed that we're using
`yield` in an interesting way. In a typical Javascript generator, `yield` is
used to send data from the generator to the caller of `next()`. You could think
of this as "yield as in crops". In Monocle, `yield` is a sign that we should
wait for the result of an asynchronous function. It's much better to think of
this as "yield as in traffic" (hat tip to [the other
monocle](https://github.com/saucelabs/monocle) for this explanation). Take
a look at this code from the example above:

```js
var data = yield request(jsonUrl);
yield fs.writeFile('/path/to/my/file.json', data[1]);
return data;
```

In the first line, we're using yield as a way to retrieve the result of an
asynchronous o-routine called `request`. This is what we mean by "yield as in
traffic". In the second line, we're doing the same kind of thing, only we're
not assigning the result to anything. These lines essentially say, "wait until
the asynchronous process is finished, and give me the result".

The third line, using the `return` statement, is how we actually send a result
back to whoever is calling this particular function. So, the rule of thumb is
this:

* `yield` when you want to wait for an o-routine or a callback and get its result
* `return` when you want to send back the result of an o-routine

Because of these semantics, Monocle checks to make sure the only type of thing
you're yielding is an o-routine or callback. See the examples below:

```js
var myFunc = o_O(function*() {
    // this is good, monocle.utils.sleep is an o-routine
    yield monocle.utils.sleep(1);

    // this is good, cb is a monocle callback
    var cb = o_C();
    setTimeout(cb, 1000);
    yield cb;

    // this is bad, we should be returning instead; Math.pow is not an o-routine.
    // Monocle will throw an error
    yield Math.pow(2, 3);

    // this is bad, we should be returning instead.
    // Monocle will throw an error
    yield 5;
});
```

Porting async libraries
-----------------------
We saw above how to make use of pre-existing async functions in o-routines,
using monocle callbacks. Monocle also provides a helper function which can be
used to turn a node-style async function into an o-routine automatically:
`monocle.monoclize()`. By "node-style async function", I mean one which takes
a series of parameters, the last of which is a callback. Monocle assumes this
callback takes at least two parameters: the first of which an error object (or
`null`) used to determine whether the original function completed successfully.

Let's look at an example. `fs.readFile()` is a node-style async function. We
can convert it into an o-routine like this:

```js
var monocle = require('monocle.js')
  , o_O = monocle.o_O
  , o_C = monocle.o_C
  , fs = require('fs');

var monoclizedRead = o_O(function*(filePath) {
    var cb = o_C();
    fs.readFile(filePath, cb);
    return (yield cb);
});
```

We can eliminate this boilerplate by using `monoclize()`:

```js
var monocle = require('monocle.js')
  , o_O = monocle.o_O
  , monoclize = monocle.monoclize
  , fs = require('fs');

var monoclizedRead = monoclize(fs.readFile);
```

For an example of how this is used to port entire Node libraries, check out
[monocle-fs](https://github.com/jlipps/monocle-fs).

Enabling Javascript generators
----------------
By default, generators are not enabled in the V8 Javascript engine which powers
Node. In Node 11, generators are available but not enabled unless you pass the
`--harmony` flag. If you're using Monocle.js, make sure to do that!

Running tests
-------------
Monocle's tests are written in Mocha. Simply run this command:

```bash
mocha --harmony test/
```

Case study
----------
I ported Monocle.js for use in [Yiewd](https://github.com/jlipps/yiewd),
a generator-based WebDriver client library. All WebDriver calls are HTTP-based,
and given Node's callback-based HTTP library, WebDriver test code descends
quickly into callback hell. Yiewd is a good example of how an existing
callback-based library can be wrapped easily and its methods turned into
o-routines for use with Monocle.

Once you've 'monoclized' an existing library, or created a new library using
o-routines, it's easy to write asynchronous Javascript code in an easy-to-read
synchronous fashion.

Monocle-enabled libraries
-------------------------
A list of Node libraries that export o-routines:

* [Yiewd](https://github.com/jlipps/yiewd)
* [monocle-fs](https://github.com/jlipps/monocle-fs)
* [monocle-request](https://github.com/jlipps/monocle-request)

Fashion
-------
One of the awesome things about the [original
monocle](https://github.com/saucelabs/monocle) was that the decorator (`@_o`) looked like a monocle-bearing individual! We can't start names with `@` in Javascript, hence the use of `o_O` in the port. But we have options. These are all exported for your particular taste:

```
monocle.o0
monocle.o_0
monocle.oO
```
