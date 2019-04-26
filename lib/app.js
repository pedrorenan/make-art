"use strict";

/*
 * Angular app module
 *
 * Define behaviour for app `run` and `config`
 */

import config from './core/config';

import tracking from './core/tracking';

import { angular } from './modules/angular.js';
/*
 * Angular app module
 *
 * Define behaviour for app `run` and `config`
 */
import authFactory from './core/auth';
import apiFactory from './api';
import { setupAuth } from './auth';

var cfg, envCfg, app = angular.module('draw', ['ngRoute']), domainCfg;

cfg = angular.extend(config.default, config[window.ENV]);

envCfg = {
    API_URL     : cfg.API_URL,
    API_URL_V2  : cfg.API_URL_V2,
    WORLD_URL   : cfg.WORLD_URL,
    OFFLINE     : cfg.OFFLINE
};

var auth = authFactory(envCfg);
var api = apiFactory(envCfg);

window.CONFIG = cfg;
domainCfg = cfg.DOMAIN_CFG;

app.constant('API', api);
app.constant('AUTH', auth);

// Configure app
app.config(function ($locationProvider) {
    $locationProvider.html5Mode(true);
});


// Run app
app.run(function ($rootScope, $window) {
    var win = angular.element($window),
        progressGroups;

    /*
     * Get last visited challenge index
     *
     * @return {Number}
     */
    function getLastChallenge(groupName) {
        return parseInt(localStorage[groupName + 'lastChallengeVisited'] || 1, 10);
    }

    /*
     * Set last visited challenge index
     *
     * @param {Number} index
     * @return void
     */
    function setLastChallenge(groupName, index) {
        if (groupName) {
            localStorage[groupName + 'lastChallengeVisited'] = index;
        }
    }

    /**
     *
     * Redirects to a certain world if
     * it matches the domain
     * e.g. hourofcode.kano.me redirects to challenges/hourofcode
     */
    function redirectIfNeeded() {
        var host = window.location.hostname,
            path = window.location.pathname,
            hashed = (window.location.href.indexOf('#') > -1);


        if (domainCfg[host] && !hashed && path === '/' && domainCfg[host].mapToWorld && path !== domainCfg[host].mapToWorld) {
            window.location.href = '/challenges/' + domainCfg[host].mapToWorld;
        }
    }

    /**
     * Initialises the progress variables
     */
    function initProgress() {
        var lsChallenge = parseInt(localStorage.challenge, 10);
        $rootScope.progress = { groups: {}};
        // Prefill progress from localStorage
        $rootScope.progress.groups = localStorage.groups ? JSON.parse(localStorage.groups) : {};
        progressGroups = $rootScope.progress.groups;
        progressGroups.basic = progressGroups.basic || {challengeNo: 1};

        //backwards compatibility
        if (lsChallenge && progressGroups.basic.challengeNo < lsChallenge) {
            progressGroups.basic.challengeNo = lsChallenge;
        }
    }

    /**
     * Loads the user profile inside the $rootScope
     * @param  {string} userId the UserId
     */
    $rootScope.loadUserProfile = function (userId) {
        if (!cfg.OFFLINE) {
            api.profile.getProfile({userId: userId}).then(function (res) {
                var user = (res && res.body) ? res.body.user : undefined;
                if (user) {
                    $rootScope.user.profile = user.profile;
                }
                $rootScope.$broadcast('user-profile-loaded');
                $rootScope.$apply();
            });
        }
    }

    /**
     * Updates the user and loggedIn state in the $rootScope
     */
    $rootScope.updateUser = function (user) {
        $rootScope.user = user;
        if (user) {
            $rootScope.loggedIn = true;
            if (user.admin_level > 0) {
                $rootScope.loadUserProfile(user.id);
            }
            $rootScope.loadProgress();
            $rootScope.$apply();
        } else {
            $rootScope.loggedIn = false;
        }
    };

    /**
     * Loads the user progress into the $rootScope
     */
    $rootScope.loadProgress = function () {
        // Load progress
        api.progress.load(function (groups) {
            if (groups && Object.keys(groups).length) {
                //incremental merge of the groups
                Object.keys(groups).forEach(function (group) {
                    var grp_obj = groups[group],
                        rsGroup;

                    $rootScope.progress.groups[group] = $rootScope.progress.groups[group] || {challengeNo: 1};
                    rsGroup = $rootScope.progress.groups[group];
                    Object.keys(grp_obj).forEach(function (key) {
                        //only merge the challengeNo if there's more progress in the API
                        if (key === "challengeNo") {
                            if (!rsGroup.challengeNo || (rsGroup.challengeNo && rsGroup.challengeNo < grp_obj.challengeNo)) {
                                rsGroup.challengeNo = grp_obj.challengeNo;
                            }
                        } else {
                            rsGroup[key] = grp_obj[key];
                        }
                    });
                });
                $rootScope.$apply();
            }
            redirectIfNeeded();
        });
    }

    /**
     * Loads the user progress into the $rootScope
     */
    function resetProgress () {
        Object.keys($rootScope.progress.groups).forEach(function(key) {
            $rootScope.progress.groups[key].challengeNo = 1;
        })
    }

    initProgress();

    // Define global app initial values
    $rootScope.cfg = cfg;
    $rootScope.api = api;
    $rootScope.offline = cfg.OFFLINE;
    $rootScope.loggedIn = false;
    $rootScope.user = null;
    $rootScope.splash = {
        display: false,
        hasDisplayed: false,
        close: function () {
            this.display = false;
            this.hasDisplayed = true;
        },
        open: function () {
            this.display = true;
        }
    };
    $rootScope.auth = {
        mode: 'login',
        showModal: false,
        setup: function () {
            return setupAuth($rootScope, api);
        },
        openModal: function (type) {
            $rootScope.auth.setup()
                .then(() => {
                    $rootScope.$apply(() => {
                        this.mode = type;
                        $rootScope.auth.el.view = this.mode;
                        this.showModal = true;
                    });
                });
        },
        closeModal: function () {
            this.showModal = false;
        },
        overlayClicked: function (e) {
            if (e.target.classList.contains('modal-overlay')) {
                $rootScope.auth.closeModal();
            }
        }
    };
    $rootScope.logout = function() {
        auth.logout(function () {
            $rootScope.updateUser();
            tracking.dispatchTrackingEvent('loggedOutOfKanoWorld');
            tracking.trackVisitType('Logged out');
            resetProgress();
        });
    };
    $rootScope.shutdown = api.server.shutdown;
    $rootScope.banner = {
        showModal: false,
        openModal: function () { this.showModal = true; },
        closeModal: function () { this.showModal = false; }
    };
    $rootScope.feedback = {
        showModal: false,
        openModal: function () { this.showModal = true; },
        closeModal: function () { this.showModal = false; }
    };
    $rootScope.$watch('user', function (user) {
        if (user) {
            if (!localStorage.uuid) {
                localStorage.uuid = user.id;
                if (user.admin_level > 0) {
                    $rootScope.loadUserProfile(user.id);
                }
            } else {
                if (localStorage.uuid !== user.id) {
                    localStorage.uuid = user.id;
                }
            }
        }
    });
    $rootScope.feedbackLoaded = function () {
        var el = document.querySelector('.kano-feedback-container');
        el.addEventListener('animationend', function () {
            document.querySelector('.kano-feedback-container').classList.remove('fadeInUp');
        });
    };

    // Initialised auth state
    auth.init($rootScope.updateUser);

    // Initialise tracking
    tracking.init();

    /*
     * Attach lastChallengeVisited get / set object to $rootScope
     */
    $rootScope.lastChallengeVisited = {
        get : getLastChallenge,
        set : setLastChallenge
    };

    /*
     * Update progress
     * @param {string} worldId the id of the world
     * @param {Number} challengeNo the new challenge
     * @return void
     */
    $rootScope.updateProgress = function (worldId, challengeNo) {
        if (worldId) {
            api.progress.save(challengeNo, worldId, function (xpGain) {
                $rootScope.xpGain = xpGain;
                $rootScope.$apply();
            });
            $rootScope.progress.groups = $rootScope.progress.groups || {};
            $rootScope.progress.groups[worldId] = $rootScope.progress.groups[worldId] || {};
            $rootScope.progress.groups[worldId].challengeNo = challengeNo;
        } else {
            $rootScope.xpGain = 0;
            $rootScope.$apply();
        }
    };

    // Listen for key press
    win.bind('keydown', function (e) {
        if (e.keyCode === 27) {
            $rootScope.$apply();
        }
    });

    // Update basePath on route change
    $rootScope.$on('$routeChangeSuccess', function (e, route) {
        var path = route.$$route ? route.$$route.originalPath : null;
        var redirection = route.$$route ? route.$$route.redirectTo : null;
        $rootScope.basePath = path ? path.split('/')[1] : '';
        if (path && !redirection) {
            tracking.dispatchVirtualPageView();
        }
    });
});

export default app;
