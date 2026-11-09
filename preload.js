const { contextBridge, ipcRenderer } = require('electron')

const call = (ch, ...args) => ipcRenderer.invoke(ch, ...args).then(r => {
  if (!r.ok) throw new Error(r.error)
  return r.data
})

contextBridge.exposeInMainWorld('xion', {
  call,
  on: (ch, fn) => {
    const listener = (_e, payload) => fn(payload)
    ipcRenderer.on(ch, listener)
    return () => ipcRenderer.removeListener(ch, listener)
  }
})
