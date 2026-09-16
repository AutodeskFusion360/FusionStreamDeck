"""Fusion API calls made on the main thread via dispatch.run_on_main_thread().

Nothing in this module touches adsk objects from a background thread.
"""
import adsk.core


def get_status():
    app = adsk.core.Application.get()
    doc = app.activeDocument
    return {
        'fusionVersion': app.version,
        'activeDocument': doc.name if doc else None,
    }


def list_commands():
    """Snapshot of every currently-registered command definition.

    Only commands loaded for the active workspace/product are present, so the
    list changes as the user switches workspaces (e.g. Design vs Manufacture).
    """
    app = adsk.core.Application.get()
    ui = app.userInterface
    out = []
    for cmd_def in ui.commandDefinitions:
        try:
            out.append({
                'id': cmd_def.id,
                'name': cmd_def.name,
                'tooltip': cmd_def.tooltip or '',
            })
        except Exception:
            continue
    return out


def execute_command(command_id):
    app = adsk.core.Application.get()
    ui = app.userInterface
    cmd_def = ui.commandDefinitions.itemById(command_id)
    if cmd_def is None:
        raise ValueError('Unknown command id: {}'.format(command_id))
    cmd_def.execute()
    return {'executed': command_id}


def get_resource_folder(command_id):
    app = adsk.core.Application.get()
    ui = app.userInterface
    cmd_def = ui.commandDefinitions.itemById(command_id)
    if cmd_def is None:
        raise ValueError('Unknown command id: {}'.format(command_id))
    folder = cmd_def.resourceFolder
    if not folder:
        raise ValueError('Command {} has no resourceFolder'.format(command_id))
    return folder
