Cohorts = (function () {
    var Options = {
        debug: false
    };

    var GoogleAnalyticsAdapter = {
        nameSpace: 'cohorts',
        trackEvent: function(category, action, opt_label, opt_value, int_hit, cv_slot, scope) { 	
			if (cv_slot) _gaq.push(['_setCustomVar', cv_slot, action, opt_label, scope]); // Set custom variable before event
			_gaq.push(['_trackEvent', category, action, opt_label, opt_value, int_hit]);
        },
        onInitialize: function(inTest, testName, cohort, cv_slot, scope) {
            if(inTest && scope !== 3) {
                this.trackEvent(this.nameSpace, testName, cohort, 0, true, cv_slot, scope); // No need for cookies at page-level scope
            }
        },
        onEvent: function(testName, cohort, eventName) {
            this.trackEvent(this.nameSpace, testName, cohort + ' | ' + eventName, 0, false);
        }
    }
	
    // The main test object
    var Test = (function () {
        var cookiePrefix = '_cohorts';

        var constructor = function (options) {
            this.options = Utils.extend({
                name: null,
                cohorts: null,
                scope: 1,
				cv_slot: null,
                sample: 1.0,
                storageAdapter: null
            }, options);

            // Check params
            if (this.options.name === null) throw ('A name for this test must be specified');
            if (this.options.cohorts === null) throw ('Cohorts must be specified for this test');
            if (Utils.size(options.cohorts) < 2) throw ('You must specify at least 2 cohorts for a test');
			if (!this.options.cv_slot) this.options.cv_slot = 5;
            if (!this.options.storageAdapter) this.options.storageAdapter = GoogleAnalyticsAdapter;

            this.cohorts = Utils.keys(this.options.cohorts);

            this.run();
        };

        constructor.prototype = {
            run: function () {
                // Determine whether there is forcing of cohorts via the URL
                var hash = window.location.hash;
                if (hash.indexOf('#') == 0) hash = hash.slice(1, hash.length);
                var pairs = hash.split('&');
                for (var i = 0; i < pairs.length; i++) {
                    var pair = pairs[i].split('=');
                    var name = pair[0];
                    var cohort = pair[1];
                    if (this.options.name == name) {
                        Utils.log('Forcing test ' + name + ' into cohort ' + cohort);
                        this.setCohort(cohort);
                    }

                }

                // Determine whether user should be in the test
                var in_test = this.inTest();
                if (in_test === null) // haven't seen this user before
                in_test = Math.random() <= this.options.sample;

                if (in_test) {
                    this.setCookie('in_test', 1);

                    if (!this.getCohort()) {
                        // determine which cohort the user is chosen to be in
                        var partitions = 1.0 / Utils.size(this.options.cohorts);
                        var chosen_partition = Math.floor(Math.random() / partitions);
                        var chosen_cohort = Utils.keys(this.options.cohorts)[chosen_partition];
                        this.setCohort(chosen_cohort);
                    } else {
                        var chosen_cohort = this.getCohort();
                    }
                    this.options.storageAdapter.onInitialize(in_test, this.options.name, chosen_cohort, this.options.cv_slot, this.options.scope);

                    // call the onChosen handler, if it exists
                    if (this.options.cohorts[chosen_cohort].onChosen) this.options.cohorts[chosen_cohort].onChosen();
                } else {
                    this.setCookie('in_test', 0);
                }
            },
            event: function (eventName) {
                if (this.inTest()) this.options.storageAdapter.onEvent(this.options.name, this.getCohort(), eventName);
            },
            inTest: function () {
                if (this.getCookie('in_test') == 1) {
                    return true;
                } else if (this.getCookie('in_test') == 0) {
                    return false;
                } else {
                    return null;
                }
            },
            inCohort: function (cohort) {
                if (this.inTest()) {
                    return this.getCohort() == cohort;
                } else {
                    return false;
                }
            },
            getCohort: function () {
                if (this.inTest()) {
                    return this.getCookie('chosen_cohort');
                } else {
                    return null;
                }
            },
            setCohort: function (cohort) {
                if (this.cohorts.indexOf(cohort) == -1) {
                    return false;
                } else {
                    this.setCookie('chosen_cohort', cohort);
                    return true;
                }
            },
            setCookie: function (name, value, options) {
                Cookies.set(cookiePrefix + '_' + this.options.name + '_' + name, value, options, this.options.scope);
            },
            getCookie: function (name) {
                return Cookies.get(cookiePrefix + '_' + this.options.name + '_' + name);
            }
        };

        return constructor;
    })();

    var Utils = {
        extend: function (destination, source) {
            for (var property in source)
            destination[property] = source[property];
            return destination;
        },
        size: function (object) {
            var i = 0;
            for (var property in object)
            i += 1;
            return i;
        },
        keys: function (object) {
            var results = [];
            for (var property in object)
            results.push(property);
            return results;
        },
        log: function (message) {
            if (window['console'] && Options.debug) {
                if (console.log) {
                    console.log(message);
                } else {
                    alert(message);
                }
            }
        }
    };

    // Adapted from James Auldridge's jquery.cookies
    var Cookies = (function () {

        var resolveOptions, assembleOptionsString, parseCookies, constructor, defaultOptions = {
            expiresAt: null,
            path: '/',
            domain: null,
            secure: false
        };

        /**
         * resolveOptions - receive an options object and ensure all options are present and valid, replacing with defaults where necessary
         *
         * @access private
         * @static
         * @parameter Object options - optional options to start with
         * @return Object complete and valid options object
         */
        resolveOptions = function (options) {
            var returnValue, expireDate;

            if (typeof options !== 'object' || options === null) {
                returnValue = defaultOptions;
            } else {
                returnValue = {
                    expiresAt: defaultOptions.expiresAt,
                    path: defaultOptions.path,
                    domain: defaultOptions.domain,
                    secure: defaultOptions.secure
                };

                if (typeof options.expiresAt === 'object' && options.expiresAt instanceof Date) {
                    returnValue.expiresAt = options.expiresAt;
                }

                if (typeof options.path === 'string' && options.path !== '') {
                    returnValue.path = options.path;
                }

                if (typeof options.domain === 'string' && options.domain !== '') {
                    returnValue.domain = options.domain;
                }

                if (options.secure === true) {
                    returnValue.secure = options.secure;
                }
            }

            return returnValue;
        };
        /**
         * assembleOptionsString - analyze options and assemble appropriate string for setting a cookie with those options
         *
         * @access private
         * @static
         * @parameter options OBJECT - optional options to start with
         * @return STRING - complete and valid cookie setting options
         */
        assembleOptionsString = function (options) {
            return (
                '; expires=' + ((options.expiresAt === null) ? 0 : options.expiresAt.toGMTString()) + '; path=' + options.path + (typeof options.domain === 'string' ? '; domain=' + options.domain : '') + (options.secure === true ? '; secure' : ''));
        };
        /**
         * parseCookies - retrieve document.cookie string and break it into a hash with values decoded and unserialized
         *
         * @access private
         * @static
         * @return OBJECT - hash of cookies from document.cookie
         */
        parseCookies = function () {
            var cookies = {}, i, pair, name, value, separated = document.cookie.split(';'),
                unparsedValue;
            for (i = 0; i < separated.length; i = i + 1) {
                pair = separated[i].split('=');
                name = pair[0].replace(/^\s*/, '').replace(/\s*$/, '');

                try {
                    value = decodeURIComponent(pair[1]);
                } catch (e1) {
                    value = pair[1];
                }

                if (typeof JSON === 'object' && JSON !== null && typeof JSON.parse === 'function') {
                    try {
                        unparsedValue = value;
                        value = JSON.parse(value);
                    } catch (e2) {
                        value = unparsedValue;
                    }
                }

                cookies[name] = value;
            }
            return cookies;
        };

        constructor = function () {};

        /**
         * get - get one, several, or all cookies
         *
         * @access public
         * @paramater Mixed cookieName - String:name of single cookie; Array:list of multiple cookie names; Void (no param):if you want all cookies
         * @return Mixed - Value of cookie as set; Null:if only one cookie is requested and is not found; Object:hash of multiple or all cookies (if multiple or all requested);
         */
        constructor.prototype.get = function (cookieName) {
            var returnValue, item, cookies = parseCookies();

            if (typeof cookieName === 'string') {
                returnValue = (typeof cookies[cookieName] !== 'undefined') ? cookies[cookieName] : null;
            } else if (typeof cookieName === 'object' && cookieName !== null) {
                returnValue = {};
                for (item in cookieName) {
                    if (typeof cookies[cookieName[item]] !== 'undefined') {
                        returnValue[cookieName[item]] = cookies[cookieName[item]];
                    } else {
                        returnValue[cookieName[item]] = null;
                    }
                }
            } else {
                returnValue = cookies;
            }

            return returnValue;
        };

        /**
         * set - set or delete a cookie with desired options
         *
         * @access public
         * @paramater String cookieName - name of cookie to set
         * @paramater Mixed value - Any JS value. If not a string, will be JSON encoded; NULL to delete
         * @paramater Object options - optional list of cookie options to specify
         * @return void
         */
        constructor.prototype.set = function (cookieName, value, options, scope) {
            if (typeof options !== 'object' || options === null) {
                var expire = new Date();

                options = {
                    expiresAt: new Date(expire),
                    path: '/',
                    domain: null,
                    secure: false
                };

                // Expire cookies after 2yrs with visitor level scope
                if (scope === 1) {
                    expire = expire.setTime(expire.getTime() + 3600000 * 24 * 730);
                    options.expiresAt = new Date(expire);
                }

                // Set cookie to expire at session level for session scope
                if (scope === 2) {
                    options.expiresAt = null;
                }

            }

            if (typeof value === 'undefined' || value === null) {
                value = '';
                options.hoursToLive = -8760;
            } else if (typeof value !== 'string') {
                if (typeof JSON === 'object' && JSON !== null && typeof JSON.stringify === 'function') {
                    value = JSON.stringify(value);
                } else {
                    throw new Error('cookies.set() received non-string value and could not serialize.');
                }
            }

            var optionsString = assembleOptionsString(options);

            document.cookie = cookieName + '=' + encodeURIComponent(value) + optionsString;
        };

        return new constructor();
    })();

    return {
        Test: Test,
        Cookies: Cookies,
        Options: Options
    };
})();
