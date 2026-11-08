self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Notification", {
      body: data.body ?? "",
      tag: data.tag,
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin))
      return open === undefined ? self.clients.openWindow("/#/push") : open.focus()
    }),
  )
})
