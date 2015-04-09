var myDataRef = new Firebase('https://yt-playlist.firebaseio.com/playlists/');

var queue = [];
var player;

var current = null;

var actions = {
    add: 1,
    remove: 2,
    moveUp: 3,
    moveDown: 4
};

function youtube_parser(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = url.match(regExp);
    if (match && match[7].length == 11) {
        return match[7];
    } else {
        return null;
    }
}

function addToQueue(code) {
    console.log(code);
    return myDataRef.push({id: code, action: actions.add});
}


$('#youtube-video').keypress(function (e) {
    if (e.keyCode == 13) {
        var url = $(this).val();
        var code = youtube_parser(url);

        if (code) {
            addToQueue(code);
            $(this).val('');

        } else {
            alert("That wasnt YT video");
        }
    }
});


myDataRef.on('child_added', function (snapshot) {
    var message = snapshot.val();

    console.log(snapshot);

    if (message.hasOwnProperty('id') &&
        message.hasOwnProperty('action') &&
        message.action == actions.add
    ) {
        addVideoToPlaylist(message.id);
    } else {
        console.log(message)
    }
});

function addVideoToPlaylist(id) {
    var parent = $("#playlist");
    $('<li/>').text(id).appendTo(parent);
    queue.push(id);
    console.log(queue);

    if (!isPlaying()) {
        playNextVideoInQueue();
    }

    //$('#messagesDiv')[0].scrollTop = $('#messagesDiv')[0].scrollHeight;
};

var tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// 3. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player-container', {
        height: '390',
        width: '640',
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

// 4. The API will call this function when the video player is ready.
function onPlayerReady(event) {
    playNextVideoInQueue();
}

// 5. The API calls this function when the player's state changes.
//    The function indicates that when playing a video (state=1),
//    the player should play for six seconds and then stop.
var done = false;

function playVideoByCode(code) {
    player.loadVideoById(code);
    player.playVideo();
}

function playNextVideoInQueue() {
    if (queue.length > 0) {
        playVideoByCode(queue[0]);
        current = queue[0];
    } else {
        stopVideo();
    }
}

function removeFromQueue(key) {
    var index = queue.indexOf(key);
    if (index > -1) {
        queue.splice(index, 1);
    }
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.ENDED && queue.length > 0) {
        removeFromQueue(current);
        playNextVideoInQueue();
    }
}


function stopVideo() {
    player.stopVideo();
}

function isPlaying() {
    if (!player) {
        return false;
    }
    var state = player.getPlayerState();
    return state == YT.PlayerState.PLAYING;
}


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

    var final = "<li class=\"result-item\" data-id=\"" + video_id + "\"\>" +
        "<div class=\"search-result-image\"><img src=\"" + video_image + "\"></div>" +
        "<div class=\"search-result-title\">" + video_title + "</div>" +
        "</li>";

    $("#search-results").append(final);
}

$("body").on("click", ".result-item", function () {
    var code = $(this).attr('data-id');
    if (code) {
        addToQueue(code);
    }
})