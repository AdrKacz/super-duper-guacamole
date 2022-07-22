function getOS() {
    var userAgent = navigator.userAgent || navigator.vendor || window.opera
  
        // Windows Phone must come first because its UA also contains 'Android'
      if (/windows phone/i.test(userAgent)) {
          return 'Windows Phone'
      }
  
      if (/android/i.test(userAgent)) {
          return 'Android'
      }
  
      // iOS detection from: http://stackoverflow.com/a/9039885/177710
      if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
          return 'iOS'
      }
  
      return 'unknown'
  }

  function redirect() {
    let os = getOS();
    if (os === 'Android') {
        window.location.href = "https://play.google.com/store/apps/details?id=com.awa.ma.dev.app" 
    } else if (os === 'iOS') {
        window.location.href = "https://apps.apple.com/fr/app/awa-chat/id1596586478"
    } else if (os === 'Windows Phone') {
        window.location.href = "https://www.awa-chat.me"
    } else {
        window.location.href = "https://www.awa-chat.me"
    }
}

redirect()