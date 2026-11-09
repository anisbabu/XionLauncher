package net.xion.client.feature;

import com.google.gson.Gson;
import com.mojang.blaze3d.platform.NativeImage;
import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.loader.api.ModContainer;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.xion.client.compat.Ids;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;
//#if MC >= 260300
import com.mojang.renderpearl.api.textures.FilterMode;
//#elif MC >= 12111
import com.mojang.blaze3d.textures.FilterMode;
//#endif
//#if MC >= 12111
import com.mojang.blaze3d.systems.RenderSystem;
//#endif

/**
 * Mod logos for the Xion menu's Mods page.
 *
 * Each mod's own icon is read from its jar, its flat background is cut away (flood fill from the
 * edges, soft edge), the transparent margin is trimmed and the logo is centred on a 64x64 canvas,
 * so every logo sits the same size with no box behind it. The image work runs on a worker thread;
 * the texture is registered on the render thread once it is ready.
 *
 * It also knows which mods Xion Launcher installed (mods/.xion-managed.json): the Xion Pack.
 */
public final class PackLogos {
	/** A ready logo: its texture id (always a 64x64 image). */
	public record Logo(Object texture) {}

	private static final int SIZE = 64;
	private static final String MANIFEST = ".xion-managed.json";
	private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(r -> {
		Thread t = new Thread(r, "Xion logo loader");
		t.setDaemon(true);
		t.setPriority(Thread.MIN_PRIORITY);
		return t;
	});
	private static final Map<String, CompletableFuture<byte[]>> JOBS = new HashMap<>();
	private static final Map<String, Optional<Logo>> READY = new HashMap<>();
	private static Set<String> managedJars;

	private PackLogos() {}

	/** Shape of the launcher's manifest; only the jar names matter here. */
	public static final class Manifest {
		public List<String> files;
	}

	/** True when Xion Launcher installed this jar (file name, with or without .disabled). */
	public static boolean isManagedJar(String fileName) {
		if (managedJars == null) managedJars = readManifest();
		if (fileName.endsWith(".disabled")) fileName = fileName.substring(0, fileName.length() - 9);
		return managedJars.contains(fileName);
	}

	/** True when the loaded mod came from a launcher-installed jar. */
	public static boolean isPreinstalled(ModContainer c) {
		try {
			for (Path p : c.getOrigin().getPaths()) {
				Path name = p.getFileName();
				if (name != null && isManagedJar(name.toString())) return true;
			}
		} catch (Exception | LinkageError ignored) {
		}
		return false;
	}

	private static Set<String> readManifest() {
		Set<String> jars = new HashSet<>();
		try {
			Path file = modsDir().resolve(MANIFEST);
			if (!Files.isRegularFile(file)) return jars;
			Manifest m = new Gson().fromJson(Files.readString(file), Manifest.class);
			if (m != null && m.files != null) jars.addAll(m.files);
		} catch (Exception ignored) {
		}
		return jars;
	}

	public static Path modsDir() {
		return FabricLoader.getInstance().getGameDir().resolve("mods");
	}

	/**
	 * The logo for a mod id, or null while it is still being prepared. An empty Optional means the
	 * mod has no usable icon. {@code source} reads the raw icon bytes (it runs on the worker thread).
	 * Call on the render thread.
	 */
	public static Optional<Logo> logo(String id, Supplier<byte[]> source) {
		Optional<Logo> done = READY.get(id);
		if (done != null) return done;
		CompletableFuture<byte[]> job = JOBS.computeIfAbsent(id, k -> CompletableFuture.supplyAsync(() -> {
			byte[] raw = source.get();
			return raw == null ? null : process(raw);
		}, WORKER));
		if (!job.isDone()) return null;
		Optional<Logo> out = Optional.empty();
		try {
			byte[] png = job.getNow(null);
			if (png != null) {
				NativeImage img = NativeImage.read(new ByteArrayInputStream(png));
				Object key = Ids.of("xionclient", "modlogo/" + id.toLowerCase().replaceAll("[^a-z0-9/._-]", "_"));
				Minecraft.getInstance().getTextureManager().register(Ids.cast(key), create(img, id));
				out = Optional.of(new Logo(key));
			}
		} catch (Exception | LinkageError e) {
			System.out.println("[Xion] No logo for " + id + ": " + e);
		}
		READY.put(id, out);
		return out;
	}

	/** Raw icon bytes of a loaded mod. */
	public static Supplier<byte[]> iconOf(ModContainer c) {
		return () -> {
			try {
				Optional<String> icon = c.getMetadata().getIconPath(128);
				if (icon.isEmpty()) return null;
				Optional<Path> p = c.findPath(icon.get());
				if (p.isEmpty() || !Files.isRegularFile(p.get())) return null;
				try (InputStream in = Files.newInputStream(p.get())) {
					return in.readAllBytes();
				}
			} catch (Exception | LinkageError e) {
				return null;
			}
		};
	}

	// ---- image work (worker thread) ----

	/** Cuts the background, trims and centres the logo; returns PNG bytes (or the input on failure). */
	static byte[] process(byte[] raw) {
		try {
			BufferedImage src = ImageIO.read(new ByteArrayInputStream(raw));
			if (src == null) return raw;
			BufferedImage img = scaled(src, 128);
			removeBackground(img);
			BufferedImage out = trimAndCentre(img);
			ByteArrayOutputStream bos = new ByteArrayOutputStream();
			ImageIO.write(out, "png", bos);
			return bos.toByteArray();
		} catch (Throwable t) {
			// AWT or ImageIO not usable here: fall back to the icon as it is.
			return raw;
		}
	}

	private static BufferedImage scaled(BufferedImage src, int max) {
		int w = src.getWidth(), h = src.getHeight();
		float k = Math.min(1f, (float) max / Math.max(w, h));
		int nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k));
		BufferedImage out = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = out.createGraphics();
		// Pixel-art icons stay crisp; large icons are smoothed down.
		boolean pixel = Math.max(w, h) <= 32;
		g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, pixel
			? RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR : RenderingHints.VALUE_INTERPOLATION_BILINEAR);
		g.drawImage(src, 0, 0, nw, nh, null);
		g.dispose();
		return out;
	}

	/** Flood fill from every edge pixel that matches the background colour; soft edge near the cut. */
	private static void removeBackground(BufferedImage img) {
		int w = img.getWidth(), h = img.getHeight();
		int[] px = img.getRGB(0, 0, w, h, null, 0, w);
		int[] corners = {px[0], px[w - 1], px[(h - 1) * w], px[h * w - 1]};
		int clear = 0;
		for (int c : corners) if ((c >>> 24) < 40) clear++;
		if (clear >= 3) return; // already has a transparent background

		// Background = the most common corner colour (by closeness).
		int bg = corners[0];
		int best = -1;
		for (int c : corners) {
			int score = 0;
			for (int o : corners) if (dist(c, o) < 40) score++;
			if (score > best) { best = score; bg = c; }
		}
		final float hard = 34f, soft = 70f;
		boolean[] seen = new boolean[w * h];
		int[] stack = new int[w * h * 4 + 2 * (w + h) + 8];
		int sp = 0;
		for (int x = 0; x < w; x++) { stack[sp++] = x; stack[sp++] = (h - 1) * w + x; }
		for (int y = 0; y < h; y++) { stack[sp++] = y * w; stack[sp++] = y * w + w - 1; }
		int[] out = px.clone();
		int removed = 0;
		while (sp > 0) {
			int i = stack[--sp];
			if (seen[i]) continue;
			seen[i] = true;
			float d = dist(px[i], bg);
			if (d >= soft) continue;
			int a = px[i] >>> 24;
			if (d < hard) {
				out[i] = px[i] & 0x00FFFFFF;
				removed++;
			} else {
				float keep = (d - hard) / (soft - hard);
				out[i] = (Math.round(a * keep) << 24) | (px[i] & 0x00FFFFFF);
				continue; // soft pixels end the fill: they are the logo's edge
			}
			int x = i % w, y = i / w;
			if (x > 0 && !seen[i - 1]) stack[sp++] = i - 1;
			if (x < w - 1 && !seen[i + 1]) stack[sp++] = i + 1;
			if (y > 0 && !seen[i - w]) stack[sp++] = i - w;
			if (y < h - 1 && !seen[i + w]) stack[sp++] = i + w;
		}
		// A logo that is all background (a plain square) is kept as it is.
		if (removed > w * h * 0.9f || removed < w * h * 0.04f) return;
		img.setRGB(0, 0, w, h, out, 0, w);
	}

	private static float dist(int a, int b) {
		int dr = ((a >> 16) & 255) - ((b >> 16) & 255);
		int dg = ((a >> 8) & 255) - ((b >> 8) & 255);
		int db = (a & 255) - (b & 255);
		int da = (a >>> 24) - (b >>> 24);
		return (float) Math.sqrt(dr * dr + dg * dg + db * db + da * da * 0.5);
	}

	private static BufferedImage trimAndCentre(BufferedImage img) {
		int w = img.getWidth(), h = img.getHeight();
		int minX = w, minY = h, maxX = -1, maxY = -1;
		for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
			if ((img.getRGB(x, y) >>> 24) > 24) {
				if (x < minX) minX = x;
				if (y < minY) minY = y;
				if (x > maxX) maxX = x;
				if (y > maxY) maxY = y;
			}
		}
		BufferedImage out = new BufferedImage(SIZE, SIZE, BufferedImage.TYPE_INT_ARGB);
		if (maxX < 0) return out;
		int cw = maxX - minX + 1, ch = maxY - minY + 1;
		int inner = SIZE - 4;
		float k = (float) inner / Math.max(cw, ch);
		int nw = Math.max(1, Math.round(cw * k)), nh = Math.max(1, Math.round(ch * k));
		Graphics2D g = out.createGraphics();
		boolean pixel = Math.max(cw, ch) <= 32;
		g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, pixel
			? RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR : RenderingHints.VALUE_INTERPOLATION_BICUBIC);
		g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
		g.drawImage(img, (SIZE - nw) / 2, (SIZE - nh) / 2, (SIZE - nw) / 2 + nw, (SIZE - nh) / 2 + nh,
			minX, minY, maxX + 1, maxY + 1, null);
		g.dispose();
		return out;
	}

	private static DynamicTexture create(NativeImage img, String id) {
		//#if MC >= 12111
		return new DynamicTexture(() -> "xion-modlogo-" + id, img) {
			{
				this.sampler = RenderSystem.getSamplerCache().getClampToEdge(FilterMode.LINEAR);
			}
		};
		//#elif MC >= 12105
		DynamicTexture t = new DynamicTexture(() -> "xion-modlogo-" + id, img);
		t.setFilter(true, false);
		return t;
		//#else
		DynamicTexture t = new DynamicTexture(img);
		t.setFilter(true, false);
		return t;
		//#endif
	}
}
