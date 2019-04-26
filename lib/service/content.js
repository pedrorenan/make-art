"use strict";
import app from '../app';
import i18n from '../i18n';

var config = window.CONFIG;

app.factory('contentService', function ($http, $q, $rootScope) {
    function getWorlds () {
        var defer = $q.defer(),
        url = config.CHALLENGES_URL + i18n.getChallengeLocalePath() + "/index.json";
        $http({
            method: 'GET',
            url: url
        }).then(function successCallback(response) {
            defer.resolve(response.data.worlds);
        }, function errorCallback(response) {
            defer.reject(response);
        });
        return defer.promise;
    }

    function getWorld(contentUrl) {
        var defer = $q.defer(),
        url = config.CHALLENGES_URL + i18n.getChallengeLocalePath() + "/" + contentUrl + "/index.json";
        $http({
            method: 'GET',
            url: url
        }).then(function successCallback(response) {

            defer.resolve(response.data);

        }, function errorCallback(response) {

            defer.reject(response);

        });
        return defer.promise;
    }

    function getChallenge(world, challenge_id) {
        var defer = $q.defer(),
        url = config.CHALLENGES_URL + i18n.getChallengeLocalePath() + "/worlds/" + world + "/" + challenge_id + ".json";
        $http({
            method: 'GET',
            url: url
        }).then(function successCallback(response) {
            defer.resolve(response.data);
        }, function errorCallback(response) {
            defer.reject(response);
        });
        return defer.promise;
    }

    function isChallengeLocked(challenge) {
        var index = challenge.index,
            now = new Date(),
            start_date = challenge.start_date;

        if (start_date) {
            start_date = new Date(start_date);
            if (start_date > now) {
                return true;
            }
        }

        return index > $rootScope.inWorldProgress.challengeNo;
    }

    function isChallengeCurrent(challenge) {
        return challenge.index === $rootScope.inWorldProgress.challengeNo;
    }

    function isChallengeCompleted(challenge) {
        return challenge.index < $rootScope.inWorldProgress.challengeNo;
    }

    function isWorldLocked(world) {
        var now = new Date(),
            date_status,
            start_date;

        if (world.start_date) {
            start_date = new Date(world.start_date);
            date_status = start_date >= now;

            if (date_status) {
                return true;
            }
        }

        if (world.dependency) {
            return !areDependenciesCompleted(world);
        }

        return false;
    }

    function isWorldCurrent(world) {
        return (world.type === "normal") && isWorldLocked(world) && !isWorldCompleted(world);
    }

    function isWorldCompleted(world) {
        var progress = getProgressGroup(world.id);
        if (progress.challengeNo > world.challenges_num) {
            return true;
        }
        return false;
    }

    function areDependenciesCompleted(world) {
        var completed = true;
        if (world.dependency) {
            world.dependency.forEach(function (worldId) {
                completed = completed && isWorldCompleted(getWorldById(worldId));
            });
        }
        return completed;
    }

    function getWorldById(id) {
        var worldObj = $rootScope.worlds.filter(function (world) {
            return world.id === id ? world : null;
        });
        return worldObj[0];
    }

    function getProgressGroup(worldId) {
        var progressGroup = $rootScope.progress.groups[worldId];

        if (!progressGroup) {
            progressGroup = {challengeNo: 1};
            $rootScope.progress.groups[worldId] = progressGroup;
        }

        return progressGroup;
    }

    function isWorldVisibile(world) {
        return world.visibility !== 'hidden';
    }

    function isCertificateAchieved(world) {
        var progress;

        if (world) {
            progress = getProgressGroup(world.id);

            if (world.certificate_after && progress.challengeNo > world.certificate_after) {
                return true;
            }
        }
        return false;
    }


    return {
        challenge: {
            get         : getChallenge,
            isLocked    : isChallengeLocked,
            isCurrent   : isChallengeCurrent,
            isCompleted : isChallengeCompleted
        },
        world: {
            get         : getWorld,
            getById     : getWorldById,
            getAll      : getWorlds,
            isLocked    : isWorldLocked,
            isCurrent   : isWorldCurrent,
            isCompleted : isWorldCompleted,
            isVisible   : isWorldVisibile,
            isCertAchieved: isCertificateAchieved
        },
        progress: {
            get         : getProgressGroup
        }
    };
});
