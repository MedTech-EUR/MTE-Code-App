# Config

This directory contains centralized configuration files and registries for the application. `sections.js` defines the modules available on the Home Hub and their visual styles; the Conference Vetting System check card opens the decision tree `CVS_CHECK_TREE_ID`, and `TREE_PAGE_TOOLS` lists sections, such as the event support checker, on the Decision Trees page. `routes.js` supplies the current Code chapters, Transparency publications, and decision trees to the pure parser in `utils/routeUtils.js`.

See [URL Routing Guide](../../ROUTING.md) before changing route-related identifiers or adding a navigable section.

For more details on how configuration is used, see the [Project Map](../../AGENTS.md#project-map).
