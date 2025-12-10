# radqy_private_vault

radqy_private_vault is the secure companion repository for the RadQy project.

This vault stores private, internal, machine-specific, or unpublished assets that must be synchronized across trusted development environments but not exposed publicly.

It mirrors selected parts of the RadQy directory structure so that private artifacts can be brought into the main project via git subtree synchronization.

Contents may include:

Internal LaTeX source files used to build documentation
(docs/tex/)

Personal or experimental examples
(examples/mine/)

Draft notes, exploratory results, or scratch assets

Private configuration files or internal models

Purpose

✔ Keep sensitive or unpublished resources private
✔ Enable reproducible development across multiple machines
✔ Sync private components cleanly into the main RadQy repo without exposing them

Usage

This repository is designed to be pulled into RadQy using git subtree, allowing private files to live in their natural locations while being versioned securely.
