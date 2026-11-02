// Decodes one AVIF off the page's main thread for studio-hdr.js: { id, bytes, depth } in,
// { id, ok, data, width, height } (or { id, ok: false, error }) out.
import decode from "./decode.js";

self.onmessage = async function (e) {
  var job = e.data;
  try {
    var img = await decode(job.bytes, { bitDepth: job.depth });
    if (!img || !img.data) throw new Error("nothing decoded");
    // hand the pixels over without a copy, unless they still sit in the decoder's memory
    var data = img.data.buffer.byteLength === img.data.byteLength ? img.data : img.data.slice();
    self.postMessage({ id: job.id, ok: true, data: data, width: img.width, height: img.height }, [data.buffer]);
  } catch (err) {
    self.postMessage({ id: job.id, ok: false, error: String((err && err.message) || err) });
  }
};
