// Readable macOS playback helper. Executed by /usr/bin/osascript -l JavaScript.
// AVFoundation keeps playing while Raycast's command process is closed.
// No application automation, browser, downloaded executable, or analytics.
ObjC.import("Foundation");
ObjC.import("AVFoundation");

function run(argv) {
  var url = argv[0];
  var statusPath = argv[1];
  function report(state, message) {
    var json = JSON.stringify({ state: state, message: message || "" });
    $.NSString.stringWithString(json).writeToFileAtomicallyEncodingError(
      statusPath,
      true,
      $.NSUTF8StringEncoding,
      null,
    );
  }
  var player;
  try {
    // AVFoundation's JXA metadata does not expose AVPlayer as $.AVPlayer on
    // all macOS versions, even though the Objective-C class is available.
    var AVPlayer = $.NSClassFromString("AVPlayer");
    if (!AVPlayer) throw new Error("AVFoundation's AVPlayer is unavailable.");
    player = AVPlayer.playerWithURL($.NSURL.URLWithString(url));
    player.play;
    var start = Date.now();
    var ready = false;
    var stalledSince = 0;
    while (true) {
      $.NSRunLoop.currentRunLoop.runUntilDate(
        $.NSDate.dateWithTimeIntervalSinceNow(0.2),
      );
      if (Number(player.currentItem.status) === 2) {
        var error = player.currentItem.error;
        report(
          "error",
          error
            ? ObjC.unwrap(error.localizedDescription)
            : "The stream could not be played.",
        );
        break;
      }
      if (Number(player.timeControlStatus) === 2) {
        stalledSince = 0;
        if (!ready) {
          ready = true;
          report("playing");
        }
      } else if (ready) {
        if (!stalledSince) stalledSince = Date.now();
        if (Date.now() - stalledSince > 60000) {
          report(
            "error",
            "The live connection stalled. Run Play to reconnect.",
          );
          break;
        }
      }
      if (!ready && Date.now() - start > 20000) {
        report(
          "error",
          "The station did not start within 20 seconds. Check your connection and try again.",
        );
        break;
      }
    }
  } catch (error) {
    report("error", String(error));
  } finally {
    if (player) player.pause;
  }
}
