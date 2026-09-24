import encode, { init } from '@jsquash/jpeg/encode'
import wasmBase64 from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm'

let ready: Promise<void> | undefined

export async function encodeJpeg(data: ImageData, quality: number, preserveText: boolean): Promise<ArrayBuffer> {
	if (!ready) {
		ready = WebAssembly.compile(Uint8Array.from(atob(wasmBase64), char => char.charCodeAt(0)))
			.then(module => init(module))
			.catch(error => {
				ready = undefined
				throw error
			})
	}
	await ready
	return encode(data, {
		quality,
		// Match ImgCompress's 4:2:0 photo output; retain 4:4:4 for text edges.
		auto_subsample: false,
		chroma_subsample: preserveText ? 1 : 2,
		progressive: true,
		optimize_coding: true,
		smoothing: 0,
	})
}
