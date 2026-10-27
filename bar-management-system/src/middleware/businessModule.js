module.exports = (key) => async (req, res, next) => {
  try {
    const { getSettings } = require("../services/businessSettingsService");
    const { effectiveModules } = require("../config/businessProfiles");
    if (!effectiveModules(await getSettings())[key])
      return res
        .status(403)
        .json({
          code: "MODULE_DISABLED",
          error: "Este módulo está desativado nas configurações da empresa",
        });
    next();
  } catch (e) {
    next(e);
  }
};
