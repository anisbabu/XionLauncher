package net.xion.client.ui;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.loader.api.ModContainer;
import net.fabricmc.loader.api.metadata.ModDependency;
import net.fabricmc.loader.api.metadata.ModMetadata;
import net.minecraft.client.gui.screens.Screen;
import net.xion.client.compat.Colors;
import net.xion.client.compat.Compat;
import net.xion.client.compat.Gfx;
import net.xion.client.feature.ModToggles;
import net.xion.client.feature.PackLogos;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Mods page of the Xion menu: an animated grid of every mod in the profile, each with its own logo
 * (background cut away), an on/off switch and a Config button. Cards slide in one after another,
 * logos float gently, switches slide. Switching a mod applies on the next launch (see ModToggles).
 */
final class ModsPanel {
	enum Click { NONE, HANDLED, FILTER, XION }

	enum Filter { ALL, PACK, ADDED }

	private static final int CARD_H = 40;
	private static final int GAP = 6;
	private static final int CHIPS_H = 20;
	/** Never switched off from here: the client itself and what every profile needs. */
	private static final Set<String> CORE = Set.of("xionclient", "fabric-api", "fabric-language-kotlin");

	private static final class Entry {
		String id, name, version;
		ModContainer container; // null for a disabled jar
		Path jar;               // set for a disabled jar
		boolean loaded, pre, xion;
		String lockedBy;        // non-null: can't be switched off
		Function<Screen, Screen> config;

		Supplier<byte[]> icon() {
			if (container != null) return PackLogos.iconOf(container);
			Path j = jar;
			return () -> readIconFromJar(j);
		}
	}

	private final List<Entry> all = new ArrayList<>();
	private final Map<String, Float> knobs = new HashMap<>();
	private Filter filter = Filter.ALL;
	private long openedAt = System.currentTimeMillis();
	private int loadedCount;

	ModsPanel(Map<String, Function<Screen, Screen>> configs) {
		scan(configs);
	}

	/** Replays the entrance animation (when the tab is opened). */
	void restart() {
		openedAt = System.currentTimeMillis();
	}

	int loadedCount() {
		return loadedCount;
	}

	// ---- data ----

	private void scan(Map<String, Function<Screen, Screen>> configs) {
		Map<String, Set<String>> neededBy = new HashMap<>();
		Set<String> loadedIds = new HashSet<>();
		for (ModContainer m : FabricLoader.getInstance().getAllMods()) {
			ModMetadata meta = m.getMetadata();
			String id = meta.getId();
			loadedIds.add(id);
			if (hidden(id) || m.getContainingMod().isPresent()) continue;
			Entry e = new Entry();
			e.id = id;
			e.name = meta.getName();
			e.version = meta.getVersion().getFriendlyString();
			e.container = m;
			e.loaded = true;
			e.xion = id.equals("xionclient");
			e.pre = e.xion || PackLogos.isPreinstalled(m);
			e.config = configs.get(id);
			all.add(e);
			try {
				for (ModDependency d : meta.getDependencies()) {
					if (d.getKind() == ModDependency.Kind.DEPENDS) {
						neededBy.computeIfAbsent(d.getModId(), k -> new LinkedHashSet<>()).add(meta.getName());
					}
				}
			} catch (Exception | LinkageError ignored) {
			}
		}
		loadedCount = all.size();
		for (Entry e : all) {
			if (CORE.contains(e.id)) e.lockedBy = e.xion ? "Xion Client" : "Every profile";
			else if (neededBy.containsKey(e.id)) {
				Set<String> by = neededBy.get(e.id);
				by.remove(e.name);
				if (!by.isEmpty()) e.lockedBy = "Needed by " + by.iterator().next() + (by.size() > 1 ? " +" + (by.size() - 1) : "");
			}
		}
		scanDisabled(loadedIds);
		all.sort(Comparator.comparing((Entry e) -> !e.xion).thenComparing(e -> !e.pre).thenComparing(e -> e.name.toLowerCase()));
	}

	private static boolean hidden(String id) {
		return id.equals("java") || id.equals("minecraft") || id.equals("fabricloader") || id.startsWith("mixinextras")
			|| (id.startsWith("fabric-") && !id.equals("fabric-api") && !id.equals("fabric-language-kotlin"));
	}

	/** Jars switched off earlier (mods/*.jar.disabled), so they can be switched back on. */
	private void scanDisabled(Set<String> loadedIds) {
		Path dir = PackLogos.modsDir();
		if (!Files.isDirectory(dir)) return;
		try (Stream<Path> files = Files.list(dir)) {
			files.filter(p -> p.getFileName().toString().endsWith(".jar.disabled")).forEach(p -> {
				JsonObject meta = readMeta(p);
				if (meta == null || !meta.has("id")) return;
				String id = meta.get("id").getAsString();
				if (loadedIds.contains(id) || hidden(id)) return;
				Entry e = new Entry();
				e.id = id;
				e.name = meta.has("name") ? meta.get("name").getAsString() : id;
				e.version = meta.has("version") ? meta.get("version").getAsString() : "";
				e.jar = p;
				e.loaded = false;
				e.pre = PackLogos.isManagedJar(p.getFileName().toString());
				all.add(e);
			});
		} catch (Exception ignored) {
		}
	}

	private static JsonObject readMeta(Path jar) {
		try (ZipFile z = new ZipFile(jar.toFile())) {
			ZipEntry en = z.getEntry("fabric.mod.json");
			if (en == null) return null;
			try (InputStream in = z.getInputStream(en)) {
				String text = new String(in.readAllBytes(), StandardCharsets.UTF_8).replaceAll("[\\u0000-\\u001f]+", " ");
				JsonElement el = JsonParser.parseString(text);
				return el.isJsonObject() ? el.getAsJsonObject() : null;
			}
		} catch (Exception e) {
			return null;
		}
	}

	private static byte[] readIconFromJar(Path jar) {
		JsonObject meta = readMeta(jar);
		if (meta == null || !meta.has("icon")) return null;
		String path = null;
		JsonElement icon = meta.get("icon");
		if (icon.isJsonPrimitive()) path = icon.getAsString();
		else if (icon.isJsonObject()) {
			int best = -1;
			for (Map.Entry<String, JsonElement> s : icon.getAsJsonObject().entrySet()) {
				try {
					int size = Integer.parseInt(s.getKey());
					if (size > best) { best = size; path = s.getValue().getAsString(); }
				} catch (NumberFormatException ignored) {
				}
			}
		}
		if (path == null) return null;
		try (ZipFile z = new ZipFile(jar.toFile())) {
			ZipEntry en = z.getEntry(path.startsWith("/") ? path.substring(1) : path);
			if (en == null) return null;
			try (InputStream in = z.getInputStream(en)) {
				return in.readAllBytes();
			}
		} catch (Exception e) {
			return null;
		}
	}

	private List<Entry> visible() {
		if (filter == Filter.ALL) return all;
		List<Entry> out = new ArrayList<>();
		for (Entry e : all) if (filter == Filter.PACK ? e.pre : !e.pre) out.add(e);
		return out;
	}

	private int count(Filter f) {
		if (f == Filter.ALL) return all.size();
		int n = 0;
		for (Entry e : all) if (f == Filter.PACK ? e.pre : !e.pre) n++;
		return n;
	}

	// ---- layout ----

	private static int cols(int w) {
		return w >= 300 ? 2 : 1;
	}

	private static int cardW(int w) {
		int c = cols(w);
		return (w - (c - 1) * GAP) / c;
	}

	int height(int w) {
		int n = visible().size();
		int c = cols(w);
		return CHIPS_H + ((n + c - 1) / c) * (CARD_H + GAP);
	}

	private String chipLabel(Filter f) {
		String name = f == Filter.ALL ? "All" : f == Filter.PACK ? "Xion Pack" : "Added";
		return name + "  " + count(f);
	}

	// ---- drawing ----

	void draw(Gfx g, int x, int y, int w, int h, double scroll, int mx, int my, float a) {
		long now = System.currentTimeMillis();
		float t = now / 1000f;

		// Filter chips
		int chipY = y - (int) scroll;
		if (chipY >= y - 1) {
			int cx = x;
			for (Filter f : Filter.values()) {
				String label = chipLabel(f);
				int cw = g.font.width(label) + 14;
				boolean sel = f == filter;
				boolean hov = mx >= cx && mx < cx + cw && my >= chipY && my < chipY + 14;
				g.pill(cx, chipY, cw, 14, Colors.alpha(sel ? Colors.lerp(Colors.CARD, Colors.ACCENT, 0.22f) : hov ? Colors.CARD_HOVER : Colors.CARD, a));
				g.pillOutline(cx, chipY, cw, 14, sel ? Colors.alpha(Colors.ACCENT, 0.7f * a) : Colors.alpha(0x14FFFFFF, a));
				g.text(label, cx + 7, chipY + 3, Colors.alpha(sel ? Colors.ACCENT : hov ? Colors.TEXT : Colors.MUTED, a), false);
				cx += cw + 5;
			}
		}

		List<Entry> list = visible();
		int c = cols(w), cw = cardW(w);
		for (int i = 0; i < list.size(); i++) {
			Entry e = list.get(i);
			int cx = x + (i % c) * (cw + GAP);
			int cy = y + CHIPS_H + (i / c) * (CARD_H + GAP) - (int) scroll;
			if (cy < y - 1 || cy + CARD_H > y + h + 1) continue;

			// Entrance: each card slides up and fades in a little after the one before it.
			float p = Math.max(0f, Math.min(1f, (now - openedAt - i * 28L) / 280f));
			float ease = 1f - (1f - p) * (1f - p) * (1f - p);
			if (ease <= 0f) continue;
			float ca = a * ease;
			int dy = Math.round((1f - ease) * 10f);
			boolean hov = ease >= 1f && mx >= cx && mx < cx + cw && my >= cy && my < cy + CARD_H;
			int top = cy + dy - (hov ? 1 : 0);

			boolean on = ModToggles.wanted(e.id, e.loaded);
			boolean pending = ModToggles.pending(e.id, e.loaded);

			// Card
			g.pill(cx, top, cw, CARD_H, Colors.alpha(hov ? Colors.CARD_HOVER : Colors.CARD, ca));
			if (hov) g.vGradient(cx + 2, top + 1, cw - 4, 12, Colors.alpha(0x14FFFFFF, ca), 0x00FFFFFF);
			int outline = hov ? Colors.alpha(Colors.ACCENT, 0.55f * ca)
				: pending ? Colors.alpha(Colors.ACCENT, (0.30f + 0.25f * pulse(t, 0)) * ca)
				: on && e.pre ? Colors.alpha(Colors.ACCENT, 0.18f * ca)
				: Colors.alpha(0x14FFFFFF, ca);
			g.pillOutline(cx, top, cw, CARD_H, outline);

			// Logo: no box behind it, floats a pixel up and down; grows a little on hover.
			int size = hov ? 26 : 24;
			int bob = Math.round((float) Math.sin(t * 2.2f + i * 0.7f) * 1.2f);
			int lx = cx + 8 - (size - 24) / 2, ly = top + (CARD_H - size) / 2 + bob;
			if (hov) g.rounded(lx - 3, ly - 3, size + 6, size + 6, Colors.alpha(Colors.ACCENT, 0.10f * ca));
			float logoA = on ? ca : ca * 0.4f;
			Optional<PackLogos.Logo> logo = PackLogos.logo(e.id, e.icon());
			if (logo == null) {
				// Still preparing: a soft shimmer.
				g.rounded(lx + 2, ly + 2, size - 4, size - 4, Colors.alpha(Colors.lerp(0xFF1A1F29, 0xFF2A3140, pulse(t * 2, i)), ca));
			} else if (logo.isPresent()) {
				g.blit(logo.get().texture(), lx, ly, size, size, 0, 0, 64, 64, 64, 64, Colors.alpha(0xFFFFFFFF, logoA));
			} else {
				// No icon: a monogram in the accent colour.
				String letter = e.name.isEmpty() ? "?" : e.name.substring(0, 1).toUpperCase();
				g.scaledText(letter, lx + size / 2f - g.font.width(letter) * 0.9f, ly + size / 2f - 6.5f, 1.8f, Colors.alpha(Colors.ACCENT, logoA), true);
			}

			// Text
			int tx = cx + 40;
			int textW = cw - 40 - 34;
			g.text(g.font.plainSubstrByWidth(e.name, textW), tx, top + 9, Colors.alpha(on ? Colors.TEXT : Colors.MUTED, ca), false);
			String sub;
			int subColor;
			if (pending) {
				sub = on ? "Turns on next launch" : "Turns off next launch";
				subColor = Colors.alpha(Colors.ACCENT, (0.65f + 0.35f * pulse(t, 0)) * ca);
			} else if (e.lockedBy != null && hov) {
				sub = e.lockedBy;
				subColor = Colors.alpha(Colors.MUTED, ca);
			} else {
				String v = e.version.length() > 14 ? e.version.substring(0, 14) : e.version;
				sub = e.xion ? "Xion Client · " + v : e.pre ? "Xion Pack · " + v : v;
				subColor = Colors.alpha(e.pre ? Colors.lerp(Colors.MUTED, Colors.ACCENT, 0.45f) : Colors.MUTED, ca);
			}
			g.text(g.font.plainSubstrByWidth(sub, textW), tx, top + 22, subColor, false);

			// Switch (animated knob)
			int sx = cx + cw - 28, sy = top + 8;
			float target = on ? 1f : 0f;
			float k = knobs.getOrDefault(e.id, target);
			k += (target - k) * 0.3f;
			if (Math.abs(target - k) < 0.01f) k = target;
			knobs.put(e.id, k);
			boolean locked = e.lockedBy != null;
			int track = locked ? 0xFF2A303C : Colors.lerp(0xFF2A303C, Colors.ACCENT, k);
			g.pill(sx, sy, 20, 10, Colors.alpha(track, locked ? ca * 0.55f : ca));
			g.rounded(sx + 1 + Math.round(10 * k), sy + 1, 8, 8, Colors.alpha(locked ? 0xFF8B94A5 : Colors.lerp(0xFF8B94A5, Colors.ON_PILL, k), locked ? ca * 0.6f : ca));

			// Config button
			if (e.config != null || e.xion) {
				int bx = sx, by = top + 23;
				boolean bh = hov && mx >= bx && mx < bx + 20 && my >= by && my < by + 11;
				g.pill(bx, by, 20, 11, Colors.alpha(bh ? Colors.lerp(Colors.CARD_HOVER, Colors.ACCENT, 0.35f) : 0xFF222834, ca));
				String gear = "⚙";
				g.text(gear, bx + 10 - g.font.width(gear) / 2, by + 2, Colors.alpha(bh ? Colors.TEXT : Colors.lerp(Colors.MUTED, Colors.ACCENT, 0.5f), ca), false);
			}
		}
	}

	/** Bottom-left status line of the menu. */
	void footer(Gfx g, int x, int y, float a) {
		int changes = ModToggles.pendingCount();
		if (changes > 0) {
			float t = System.currentTimeMillis() / 1000f;
			String s = "↻ " + changes + (changes == 1 ? " change" : " changes") + " — restart the game to apply";
			g.text(s, x, y, Colors.alpha(Colors.ACCENT, (0.7f + 0.3f * pulse(t, 0)) * a), false);
		} else {
			int pre = count(Filter.PACK);
			g.text(all.size() + " mods  ·  " + pre + " in Xion Pack", x, y, Colors.alpha(Colors.MUTED, a), false);
		}
	}

	private static float pulse(float t, int phase) {
		return (float) (Math.sin(t * 3.0 + phase * 0.6) + 1) / 2f;
	}

	// ---- input ----

	Click click(double mx, double my, int x, int y, int w, int h, double scroll, Screen parent) {
		if (mx < x || mx >= x + w || my < y || my >= y + h) return Click.NONE;
		// Chips
		int chipY = y - (int) scroll;
		if (my >= chipY && my < chipY + 14) {
			int cx = x;
			for (Filter f : Filter.values()) {
				int cw = net.minecraft.client.Minecraft.getInstance().font.width(chipLabel(f)) + 14;
				if (mx >= cx && mx < cx + cw) {
					if (filter != f) {
						filter = f;
						restart();
					}
					Compat.click();
					return Click.FILTER;
				}
				cx += cw + 5;
			}
			return Click.NONE;
		}
		List<Entry> list = visible();
		int c = cols(w), cw = cardW(w);
		for (int i = 0; i < list.size(); i++) {
			int cx = x + (i % c) * (cw + GAP);
			int cy = y + CHIPS_H + (i / c) * (CARD_H + GAP) - (int) scroll;
			if (mx < cx || mx >= cx + cw || my < cy || my >= cy + CARD_H) continue;
			Entry e = list.get(i);
			int sx = cx + cw - 28;
			boolean onSwitch = mx >= sx - 3 && mx < sx + 23 && my >= cy + 5 && my < cy + 21;
			boolean onGear = (e.config != null || e.xion) && mx >= sx && mx < sx + 20 && my >= cy + 22 && my < cy + 35;
			if (onGear || (!onSwitch && (e.config != null || e.xion))) return openConfig(e, parent);
			Compat.click();
			if (e.lockedBy == null) ModToggles.set(e.id, !ModToggles.wanted(e.id, e.loaded), e.loaded);
			return Click.HANDLED;
		}
		return Click.NONE;
	}

	private Click openConfig(Entry e, Screen parent) {
		Compat.click();
		if (e.xion) return Click.XION;
		try {
			Screen sc = e.config.apply(parent);
			if (sc != null) Compat.setScreen(sc);
		} catch (Exception | LinkageError ex) {
			System.out.println("[Xion] Could not open config: " + ex);
		}
		return Click.HANDLED;
	}
}
