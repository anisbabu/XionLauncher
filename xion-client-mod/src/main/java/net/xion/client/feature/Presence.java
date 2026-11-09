package net.xion.client.feature;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.Minecraft;
import net.xion.client.XionConfig;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lets Xion Client players see each other's badge on servers. While you are on a server (and the badge is
 * on) the client tells Xion's presence service your UUID every few minutes, and asks which players were
 * seen recently. Nothing else is sent: no name, no server, no chat. Turn "Xion Badge" off to stop both.
 */
public final class Presence {
	private static final String API = "https://xion-launcher.vercel.app/api/presence";
	private static final long ANNOUNCE_EVERY = 4 * 60_000L;
	private static final long FETCH_EVERY = 40_000L;

	/** Players running Xion Client -> whether they have Xion+. */
	private static final Map<UUID, Boolean> ONLINE = new ConcurrentHashMap<>();
	private static long lastAnnounce, lastFetch;
	private static volatile boolean busy;

	private Presence() {}

	public static boolean has(UUID id) {
		return id != null && ONLINE.containsKey(id);
	}

	public static boolean pro(UUID id) {
		return id != null && Boolean.TRUE.equals(ONLINE.get(id));
	}

	/** Called every client tick. */
	public static void tick(Minecraft mc) {
		if (mc.player == null || mc.getCurrentServer() == null || !XionConfig.data.badge) {
			if (mc.player == null && !ONLINE.isEmpty()) ONLINE.clear();
			return;
		}
		if (busy) return;
		long now = System.currentTimeMillis();
		boolean announce = now - lastAnnounce > ANNOUNCE_EVERY;
		if (!announce && now - lastFetch < FETCH_EVERY) return;
		String id = mc.player.getUUID().toString().replace("-", "");
		String key = Premium.active() ? XionConfig.launcher.licenseKey : "";
		if (announce) lastAnnounce = now;
		lastFetch = now;
		busy = true;
		Thread t = new Thread(() -> {
			try {
				if (announce) post(id, key);
				fetch();
			} catch (Exception ignored) {
			} finally {
				busy = false;
			}
		}, "Xion-Presence");
		t.setDaemon(true);
		t.start();
	}

	private static void post(String id, String key) throws Exception {
		JsonObject body = new JsonObject();
		body.addProperty("id", id);
		body.addProperty("key", key == null ? "" : key);
		HttpURLConnection c = open("POST");
		c.setDoOutput(true);
		c.setRequestProperty("Content-Type", "application/json");
		try (OutputStream out = c.getOutputStream()) {
			out.write(body.toString().getBytes(StandardCharsets.UTF_8));
		}
		c.getResponseCode();
		c.disconnect();
	}

	private static void fetch() throws Exception {
		HttpURLConnection c = open("GET");
		if (c.getResponseCode() != 200) {
			c.disconnect();
			return;
		}
		String text;
		try (InputStream in = c.getInputStream()) {
			text = new String(in.readAllBytes(), StandardCharsets.UTF_8);
		}
		c.disconnect();
		JsonArray list = JsonParser.parseString(text).getAsJsonObject().getAsJsonArray("o");
		Map<UUID, Boolean> next = new ConcurrentHashMap<>();
		for (JsonElement e : list) {
			String s = e.getAsString();
			if (s.length() != 33) continue;
			try {
				UUID id = UUID.fromString(s.substring(0, 8) + "-" + s.substring(8, 12) + "-" + s.substring(12, 16) + "-"
					+ s.substring(16, 20) + "-" + s.substring(20, 32));
				next.put(id, s.charAt(32) == 'p');
			} catch (IllegalArgumentException ignored) {
			}
		}
		ONLINE.keySet().retainAll(next.keySet());
		ONLINE.putAll(next);
	}

	private static HttpURLConnection open(String method) throws Exception {
		HttpURLConnection c = (HttpURLConnection) new URL(API).openConnection();
		c.setRequestMethod(method);
		c.setConnectTimeout(6000);
		c.setReadTimeout(6000);
		c.setRequestProperty("User-Agent", "XionClient");
		return c;
	}
}
