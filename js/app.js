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
        $("#search").keyup(function () {
            var search_input = $(this).val();
            var keyword = encodeURIComponent(search_input);
// Youtube API
            var yt_url = 'http://gdata.youtube.com/feeds/api/videos?q=' + keyword + '&format=5&max-results=5&v=2&alt=jsonc';

            $.ajax
            ({
                type: "GET",
                url: yt_url,
                dataType: "jsonp",
                success: function (response) {
                    $("#search-results").html('');
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
                "<div class='col-sm-7'><div class=\"search-result-image\"><img src=\"" + video_image + "\"></div></div>" +
                "<div class='col-sm-5'><span class=\"search-result-title\">" + video_title + "</span></div>" +
                "</li>";

            $("#search-results").append(final);
        }

        $("body").on("click", ".result-item", function () {
            var code = $(this).attr('data-id');
            if (code) {
                self.addToQueue(code);
            }
        })
    },

    hashChanged: function (hash) {
        console.log(hash);
        switch (hash) {
            case '#join':
                this.joinAction();
                break;
            case '#new':
                this.newAction();
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

    loadPlaylist: function (id) {
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

        if (message.hasOwnProperty('id') &&
            message.hasOwnProperty('action') &&
            message.action == application.actions.add
        ) {
            application.addVideoToPlaylist(message.id);
        } else {
        }
    },

    addVideoToPlaylist: function (id) {
        console.log('addVideoToPlaylist');
        var parent = $("#playlist");

        //$('<li/>').text(id).appendTo(parent);

        $('<li/>').html('<img src="http://img.youtube.com/vi/' + id + '/default.jpg">').appendTo(parent);

        this.queue.push(id);
        console.log(this.queue);

        if (!this.isPlaying() && this.playerLoaded) {
            console.log('play');
            this.playNextVideoInQueue();
        }

        //$('#messagesDiv')[0].scrollTop = $('#messagesDiv')[0].scrollHeight;
    },

    getPlaylistConn: function () {
        return this.con.child(this.playlistid);
    },

    addToQueue: function (data) {
        console.log(this.getPlaylistConn().push({id: data, action: this.actions.add}));
        return;
        return this.getPlaylistConn().push({id: data, action: this.actions.add});
    },

    actions: {
        add: 1,
        remove: 2
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

    removeFromQueue: function (key) {
        console.log('removing ' + key);
        var index = this.queue.indexOf(key);
        if (index > -1) {
            this.queue.splice(index, 1);
        }
    },

    playVideoByCode: function (code) {
        this.player.loadVideoById(code);
        this.player.playVideo();
    },

    playNextVideoInQueue: function () {
        if (this.queue.length > 0) {
            var cur = this.queue[this.currentIndex + 1];
            this.playVideoByCode(cur);
            this.current = cur;
            this.currentIndex = this.currentIndex + 1;
        }
    }
};

$(function () {
    application.init();
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

