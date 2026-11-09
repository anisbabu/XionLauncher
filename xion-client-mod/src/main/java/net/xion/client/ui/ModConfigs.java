package net.xion.client.ui;

import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.loader.api.entrypoint.EntrypointContainer;
import net.minecraft.client.gui.screens.Screen;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * Finds config screens that mods expose through Mod Menu's "modmenu" entrypoint (Sodium Extra,
 * Zoomify, Iris and most others), without a compile-time dependency on Mod Menu.
 */
final class ModConfigs {
	private ModConfigs() {}

	static Map<String, Function<Screen, Screen>> discover() {
		Map<String, Function<Screen, Screen>> out = new HashMap<>();
		try {
			for (EntrypointContainer<Object> c : FabricLoader.getInstance().getEntrypointContainers("modmenu", Object.class)) {
				try {
					Object api = c.getEntrypoint();
					String modId = c.getProvider().getMetadata().getId();
					Object factory = call(api, "getModConfigScreenFactory");
					if (factory != null) out.putIfAbsent(modId, parent -> create(factory, parent));
					// Some mods provide screens for other mods (e.g. a library for its dependents).
					Object provided = call(api, "getProvidedConfigScreenFactories");
					if (provided instanceof Map<?, ?> map) {
						for (Map.Entry<?, ?> e : map.entrySet()) {
							Object f = e.getValue();
							if (e.getKey() instanceof String id && f != null) out.putIfAbsent(id, parent -> create(f, parent));
						}
					}
				} catch (Exception | LinkageError ignored) {
					// A broken entrypoint just means that mod shows without a Configure button.
				}
			}
		} catch (Exception | LinkageError ignored) {
		}
		return out;
	}

	private static Object call(Object target, String name) throws Exception {
		Method m = findMethod(target.getClass(), name, 0);
		if (m == null) return null;
		m.setAccessible(true);
		return m.invoke(target);
	}

	private static Screen create(Object factory, Screen parent) {
		try {
			Method m = findMethod(factory.getClass(), "create", 1);
			if (m == null) return null;
			m.setAccessible(true);
			Object s = m.invoke(factory, parent);
			return s instanceof Screen sc ? sc : null;
		} catch (Exception | LinkageError e) {
			return null;
		}
	}

	private static Method findMethod(Class<?> c, String name, int params) {
		for (Class<?> k = c; k != null; k = k.getSuperclass()) {
			for (Method m : k.getDeclaredMethods()) if (m.getName().equals(name) && m.getParameterCount() == params) return m;
			for (Class<?> i : k.getInterfaces()) {
				for (Method m : i.getMethods()) if (m.getName().equals(name) && m.getParameterCount() == params) return m;
			}
		}
		return null;
	}
}
