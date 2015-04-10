application = {
    con: null,
    url: null,
    playlistid: null,
    player: null,
    current: null,
    currentIndex: -1,
    playerLoaded: false,

    queue: [],

    base: 'https://yt-playlist.firebaseio.com/',

    init: function () {

        $.ajaxSetup({
            cache: false
        });

        var self = this
        this.url = new Url;

        // Hash change tracking
        if ("onhashchange" in window) { // event supported?
            window.onhashchange = function () {
                self.hashChanged(window.location.hash);
            }
        } else { // event not supported:
            var storedHash = window.location.hash;
            window.setInterval(function () {
                if (window.location.hash != storedHash) {
                    storedHash = window.location.hash;
                    self.hashChanged(storedHash);
                }
            }, 100);
        }
    },

    setupSearch: function () {
        var self = this;
        var searchInput = $("#search");

        function clearResults() {
            $("#search-results").html('');
        }

        $("#clear-results").on('click', function () {
            clearResults();
        });

        searchInput.keyup(function () {
            var searchValue = $(this).val();

            if (searchValue.length < 3) {
                clearResults();
                return;
            }

            if (!searchValue || searchValue == '') {
                clearResults();
                return;
            }

            var keyword = encodeURIComponent(searchValue);
            // Youtube API
            var yt_url = 'http://gdata.youtube.com/feeds/api/videos?q=' + keyword + '&format=5&max-results=5&v=2&alt=jsonc';

            $.ajax
            ({
                type: "GET",
                url: yt_url,
                dataType: "jsonp",
                success: function (response) {
                    clearResults();
                    if (response.data.items) {
                        $.each(response.data.items, function (i, data) {
                            createResultEntry(data)
                        });
                    }
                    else {
                        $("#search-results").append('<li>No results</li>');
                    }
                }
            });
        });

        function getThumbnailByCode(code) {
            return 'http://img.youtube.com/vi/' + code + '/default.jpg';
        }

        function createResultEntry(data) {
            var video_id = data.id;
            var video_title = data.title;
            var video_image = getThumbnailByCode(data.id);

            /*var final = "<li class=\"result-item\" data-id=\"" + video_id + "\"\\>" +
             "<div class=\"search-result-image\"><img src=\"" + video_image + "\"></div>" +
             "<div class=\"search-result-title\">" + video_title + "</div>" +
             "</li>";*/
            var final = "<li class=\"result-item\" data-id=\"" + video_id + "\"\\>" +
                "<div class=\"search-result-image\"><img src=\"" + video_image + "\"></div></div>" +
                "<div class=\"search-result-title\">" + video_title + "</div>" +
                "</li>";

            $("#search-results").append(final);
        }

        $("body").on("click", ".result-item:not(.item-added)", function () {
            $(this).addClass('item-added');
            var code = $(this).attr('data-id');
            if (code) {
                self.addToQueue(code);
            }
        })
    },

    hashChanged: function (hash) {
        console.log(hash);

        function Route(regex, action) {
            this.regex = regex;
            this.action = action;

            this.check = function (url) {
                console.log('checking ' + url);
                console.log(url.match(this.regex));
            }
        }

        var routes = {

            init: function () {
                console.log(this);
                this.array.push(new Route(/#join/, 'joinAction'));
                this.array.push(new Route(/#new/, 'newAction'));
                this.array.push(new Route(/#playlist/, 'playlistAction'));
            },

            array: []
        };

        routes.init();

        console.log(routes.array);

        for (var i = 0; i < routes.array.length; i++) {
            if (routes.array[i].check(hash)) {
                console.log('OK ' + routes.action);
            }
        }

        if (hash.match(/#join/)) {
            console.log('regex match join')
        } else if (hash.match(/#new/)) {
            console.log('regex match new')
        } else if (hash.match(/#playlist/)) {
            console.log('regex match playlist')
        }


        switch (hash) {
            case '#join':
                this.joinAction();
                break;
            case '#new':
                this.newAction();
                break;
            case '#playlist':
                this.playlistAction();
                break;
        }
    },

    connect: function (ref) {
        ref = ref || ''
        this.con = new Firebase(this.base + ref);
        return this.con;
    },

    newAction: function () {
        var self = this;
        id = this.random();
        con = this.connect('');

        con.child(id).once('value', function (snapshot) {
            var exists = (snapshot.val() !== null);
            if (exists) {
                self.newAction();
            } else {
                self.loadPlaylist(id);
            }
        });
    },

    playlistAction: function () {
        var u = new Url;
        console.log(u);
    },

    loadPlaylist: function (id) {
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem("ytplaylist.lastPlaylistId", id);
        }


        var self = this;
        this.loadPage('playlist.html', function () {
            self.setupSearch();
            $("#playlist-id").html(id);
            self.playlistid = id;

            self.getPlaylistConn().on('child_added', self.handleChildAdded);

            $('#youtube-video').keypress(function (e) {
                if (e.keyCode == 13) {
                    var url = $(this).val();
                    var code = youtube_parser(url);

                    if (code) {
                        self.addToQueue(code);
                        $(this).val('');

                    } else {
                        alert("That wasnt YT video");
                    }
                }
            });

            var tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api?enablejsapi=1";
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        });
    },

    handleChildAdded: function (snapshot) {
        var message = snapshot.val();

        if (message.hasOwnProperty('id') && message.hasOwnProperty('action')) {
            if (message.action == application.actions.add) {
                application.addVideoToPlaylist(message.id);
            } else if (message.action == application.actions.remove) {
                application.removeVideoFromPlaylist(message.id);
            } else if (message.action == application.actions.moveDown) {
                application.moveVideoDownInPlaylist(message.id);
            } else if (message.action == application.actions.moveUp) {
                application.moveVideoUpInPlaylist(message.id);
            }

        }
    },

    createPlaylistView: function () {
        var parent = $("#playlist");
        var self = this;

        parent.html('');
        for (var i = 0; i < this.queue.length; i++) {
            $('<li/>').addClass('playlist-item')
                .attr({"data-id": this.queue[i]})
                .html('<img src="http://img.youtube.com/vi/' + this.queue[i] + '/default.jpg">')
                .append('<div class="remove-item" data-id="' + this.queue[i] + '"><i class="fa fa-trash"></i></div>')
                .append('<div class="down-item" data-id="' + this.queue[i] + '"><i class="fa fa-2x fa-arrow-down"></i></div>')
                .append('<div class="up-item" data-id="' + this.queue[i] + '"><i class="fa fa-2x fa-arrow-up"></i></div>')
                .appendTo(parent);
        }

        $('body').off('click.ytplaylist');
        $("body").on("click.ytplaylist", ".playlist-item:not(.current)", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var code = $(this).attr('data-id');
            self.playVideoByCode(code);
        });

        $("body").on("click.ytplaylist", ".playlist-item .remove-item", function (e) {
            e.preventDefault();
            e.stopPropagation();

            var code = $(this).attr('data-id');
            if (!confirm('Are you sure?')) {
                return;
            }
            self.removeFromQueue(code);
        });

        $("body").on("click.ytplaylist", ".playlist-item .up-item", function (e) {
            e.preventDefault();
            e.stopPropagation();

            var code = $(this).attr('data-id');
            self.moveUp(code);
        });

        $("body").on("click.ytplaylist", ".playlist-item .down-item", function (e) {
            e.preventDefault();
            e.stopPropagation();

            var code = $(this).attr('data-id');
            self.moveDown(code);
        });
    },

    addVideoToPlaylist: function (id) {
        console.log('addVideoToPlaylist');

        this.queue.push(id);
        console.log(this.queue);

        this.createPlaylistView();

        //if (!this.isPlaying() && this.playerLoaded) {
        //    console.log('play');
        //    this.playNextVideoInQueue();
        //}

        //$('#messagesDiv')[0].scrollTop = $('#messagesDiv')[0].scrollHeight;
    },

    getPlaylistConn: function () {
        return this.con.child(this.playlistid);
    },

    addToQueue: function (data) {
        console.log(this.getPlaylistConn().push({id: data, action: this.actions.add}));
        //return this.getPlaylistConn().push({id: data, action: this.actions.add});
    },

    removeFromQueue: function (code) {
        console.log(this.getPlaylistConn().push({id: code, action: this.actions.remove}));
    },

    moveUp: function (code) {
        console.log(this.getPlaylistConn().push({id: code, action: this.actions.moveUp}));
    },

    moveDown: function (code) {
        console.log(this.getPlaylistConn().push({id: code, action: this.actions.moveDown}));
    },

    actions: {
        add: 1,
        remove: 2,
        moveUp: 3,
        moveDown: 4
    },

    random: function () {
        // Math.random should be unique because of its seeding algorithm.
        // Convert it to base 36 (numbers + letters), and grab the first 9 characters
        // after the decimal.
        return Math.random().toString(36).substr(2, 9);
    },

    joinAction: function () {
        var id = $("#join-id").val();

        var self = this;

        if (!id) {
            console.log(id);
            this.notify('No playlist ID specified', 'danger');
            this.redirect('');
        } else {
            this.playlistid = id;
            this.connect();
            this.getPlaylistConn().once('value', function (snapshot) {
                var exists = (snapshot.val() !== null);
                if (exists) {
                    self.loadPlaylist(id);
                } else {
                    self.redirect('');
                    console.log('not found');
                    self.notify('playlist not found', 'danger');
                }
            });
        }
    },

    redirect: function (path) {
        window.location.hash = path;
    },

    hideNotify: function () {
        $("#notification").hide().html('');
    },

    notify: function (text, type) {
        this.hideNotify();
        $("#notification").html('<div class="alert alert-' + type + '">' + text + '</div>');
        $("#notification").fadeIn();
    },

    loadPage: function (page, callback) {
        this.hideNotify();
        $.ajax({
            url: page,
            dataType: 'HTML'
        }).done(function (data) {
            $("#main").html("");
            $("#main").append(data);

            if (callback) {
                callback()
            }

        });
    },

    isPlaying: function () {
        console.log('isPlaying');

        if (!this.player || typeof(this.player.getPlayerState) != 'function') {
            return false;
        }

        var state = this.player.getPlayerState();
        return state == YT.PlayerState.PLAYING;
    },

    getIndexOf: function (key) {
        var index = this.queue.indexOf(key);
        return index;
    },

    switchPlaces: function (index1, index2) {
        var temp = this.queue[index1];
        this.queue[index1] = this.queue[index2];
        this.queue[index2] = temp;
    },

    moveVideoUpInPlaylist: function (key) {
        var index = this.getIndexOf(key);
        if (index < this.queue.length && index > 1) {
            this.switchPlaces(index, index - 1);
        }
        this.createPlaylistView();
    },

    moveVideoDownInPlaylist: function (key) {
        var index = this.getIndexOf(key);
        if (index > 0 && index < this.queue.length - 1) {
            this.switchPlaces(index, index + 1);
        }
        this.createPlaylistView();
    },

    removeVideoFromPlaylist: function (key) {
        console.log('removing ' + key);
        var index = this.getIndexOf(key);
        if (index > -1) {
            this.queue.splice(index, 1);
        }
        this.createPlaylistView();
    },

    playVideoByCode: function (code) {
        console.log('Playing video by code ' + code)
        if (this.isPlaying()) {
            this.player.stopVideo();
        }

        this.player.loadVideoById(code);
        this.player.playVideo();

        $('.playlist-item.current').removeClass('current');
        console.log('.playlist-item[data-id="' + code + '"]');
        $('.playlist-item[data-id="' + code + '"]').addClass('current');

        this.current = code;
        this.currentIndex = this.getIndexOf(this.current);

    },

    playNextVideoInQueue: function () {
        if (this.queue.length > 0) {
            var cur = this.queue[this.currentIndex + 1];
            this.playVideoByCode(cur);
        }
    }
};

$(function () {
    application.init();
    $("#last-playlist-id").html(localStorage.getItem("ytplaylist.lastPlaylistId"));
    application.hashChanged(window.location.hash);
});


function youtube_parser(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = url.match(regExp);
    if (match && match[7].length == 11) {
        return match[7];
    } else {
        return null;
    }
}

function onYouTubeIframeAPIReady() {
    application.player = new YT.Player('player-container', {
        height: '390',
        width: '640',
        video: null,
        playerVars: {
            wmode: "opaque"
        },
        events: {
            'onReady': function () {
                console.log('YT Ready');
                application.playNextVideoInQueue();
                application.playerLoaded = true;

            },
            'onStateChange': function (event) {
                if (event.data == YT.PlayerState.ENDED && application.queue.length > 0) {
                    //application.removeFromQueue(application.current);
                    application.playNextVideoInQueue();
                }
            }
        }
    });
}

