package net.xion.client.feature;

import net.xion.client.XionConfig;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Xion Premium. The launcher passes the player's license key along; the client verifies its Ed25519
 * signature itself, and a key made for a Device ID only unlocks on that computer, so editing or copying
 * config files cannot unlock anything.
 */
public final class Premium {
	private static final String PUBLIC_KEY_B64 = "a5cn2efk6Jh2DpcxBDUHDQPOVIGFE5Xhdz+uMkp8wa4=";
	private static final Pattern KEY = Pattern.compile("^XION-([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)$");
	private static Boolean cached;
	private static String owner = "";

	private Premium() {}

	public static boolean active() {
		if (cached == null) cached = verify(XionConfig.launcher.licenseKey);
		return cached;
	}

	/** Name the license was issued to (empty when not premium). */
	public static String owner() {
		active();
		return owner;
	}

	private static boolean verify(String key) {
		if (key == null) return false;
		Matcher m = KEY.matcher(key.trim());
		if (!m.matches()) return false;
		try {
			byte[] raw = Base64.getDecoder().decode(PUBLIC_KEY_B64);
			byte[] spki = new byte[12 + raw.length];
			byte[] prefix = {0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00};
			System.arraycopy(prefix, 0, spki, 0, 12);
			System.arraycopy(raw, 0, spki, 12, raw.length);
			PublicKey pub = KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(spki));
			byte[] payload = Base64.getUrlDecoder().decode(m.group(1));
			Signature sig = Signature.getInstance("Ed25519");
			sig.initVerify(pub);
			sig.update(payload);
			if (!sig.verify(Base64.getUrlDecoder().decode(m.group(2)))) return false;
			String json = new String(payload, StandardCharsets.UTF_8);
			// Keys made before device locking have no "d" and keep working.
			String device = field(json, "d");
			if (!device.isEmpty() && !device.equals(deviceId())) return false;
			owner = field(json, "n");
			return true;
		} catch (Exception | LinkageError e) {
			return false;
		}
	}

	private static String field(String json, String name) {
		Matcher f = Pattern.compile("\"" + name + "\":\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(json);
		return f.find() ? f.group(1) : "";
	}

	/** Same value as the launcher's license.deviceId(): sha256("xion-device:" + MachineGuid), first 16 hex chars. */
	private static String deviceId() {
		String guid = "";
		if (System.getProperty("os.name", "").toLowerCase().contains("win")) {
			try {
				Process p = new ProcessBuilder("reg", "query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid").redirectErrorStream(true).start();
				try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
					String line;
					Pattern g = Pattern.compile("MachineGuid\\s+REG_SZ\\s+(\\S+)");
					while ((line = r.readLine()) != null) {
						Matcher gm = g.matcher(line);
						if (gm.find()) guid = gm.group(1);
					}
				}
				p.waitFor();
			} catch (Exception ignored) {
			}
		} else {
			for (String f : new String[] {"/etc/machine-id", "/var/lib/dbus/machine-id"}) {
				try {
					guid = new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(f)), StandardCharsets.UTF_8).trim();
				} catch (Exception ignored) {
				}
				if (!guid.isEmpty()) break;
			}
		}
		try {
			byte[] h = MessageDigest.getInstance("SHA-256").digest(("xion-device:" + guid.toLowerCase()).getBytes(StandardCharsets.UTF_8));
			StringBuilder sb = new StringBuilder();
			for (byte b : h) sb.append(String.format("%02x", b));
			return sb.substring(0, 16);
		} catch (Exception e) {
			return "";
		}
	}
}
