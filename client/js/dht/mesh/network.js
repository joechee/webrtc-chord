/* 
Functions that are too useful to be left in one file
*/


(function (window) {
  var INT32_MAX = 2147483647;
	
  function forwardDistance(a, b) {
    a = parseInt(a, 10);
    b = parseInt(b, 10);
    if (!a || !b) {
      return INT32_MAX * 2;
    }
    var distance = b - a;
    if (distance < 0) {
      distance += INT32_MAX + 1;
    }
    return distance;
  }

  function modulo(a, b) {
    while (a < 0) {
      a = a + b;
    }

    return a % b;
  }

  window.forwardDistance = forwardDistance;
  window.INT32_MAX = INT32_MAX;
  window.modulo = modulo;
})(window);