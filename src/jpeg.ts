import encode, { init } from '@jsquash/jpeg/encode'
import wasmBase64 from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm'

let ready: Promise<void> | undefined

export async function encodeTextFriendlyJpeg(data: ImageData, quality: number): Promise<ArrayBuffer> {
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
		// Preserve full-resolution color at sharp text edges (4:4:4).
		auto_subsample: false,
		chroma_subsample: 1,
		progressive: true,
		optimize_coding: true,
		smoothing: 0,
	})
}
