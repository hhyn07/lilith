'use strict'
// Lilith: also accept connections on the IPv6 loopback when the server is
// bound to 127.0.0.1.
//
// Browsers resolve "localhost" to ::1 first. With nothing listening there,
// Windows takes about 0.2-0.4 s to refuse the attempt before the browser falls
// back to 127.0.0.1 -- on every new connection, so every page load started
// with a visible pause. This forwards [::1]:port to 127.0.0.1:port at the TCP
// level (HTTP and websockets alike). It only ever listens on a loopback
// address, so nothing becomes reachable from other machines.

const net = require('net')
const logger = require('./logger')

function startLoopbackForwarder (port, targetHost = '127.0.0.1') {
  // allowHalfOpen: a client may finish sending its request and still read the reply
  const forwarder = net.createServer({ allowHalfOpen: true }, function (client) {
    const upstream = net.connect({ port, host: targetHost, allowHalfOpen: true })
    const close = function () {
      client.destroy()
      upstream.destroy()
    }
    client.on('error', close)
    upstream.on('error', close)
    client.on('close', close)
    upstream.on('close', close)
    client.pipe(upstream)
    upstream.pipe(client)
  })
  forwarder.on('error', function (err) {
    // e.g. no IPv6 on this machine, or the port is taken: the site still works on 127.0.0.1
    logger.warn('IPv6 loopback forwarder not started: ' + err.message)
  })
  forwarder.listen(port, '::1', function () {
    logger.info('Forwarding [::1]:%s to %s:%s', port, targetHost, port)
  })
  return forwarder
}

module.exports = { startLoopbackForwarder }
