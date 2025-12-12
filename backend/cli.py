import typer
from enum import Enum

app = typer.Typer()

class Segmenter(str, Enum):
    adaptiveborder = "adaptiveborder"
    otsuhull = "otsuhull"
    regiongrowing = "regiongrowing"
    unet = "unet"
    fcn = "fcn"
    mobilenet = "mobilenet"

@app.command()
def run(
    segmenter: Segmenter | None = typer.Argument(
        None,
        help="Segmentation method"
    ),
    interactive: bool = typer.Option(
        False,
        "--interactive",
        "-i",
        help="Select segmenter interactively"
    )
):
    if segmenter is None or interactive:
        try:
            import questionary
        except ImportError:
            typer.secho(
                "questionary is required for interactive selection. Install it with: pip install questionary",
                fg="red",
                err=True,
            )
            raise typer.Exit(code=1)

        segmenter = questionary.select(
            "Select segmenter:",
            choices=[s.value for s in Segmenter],
        ).ask()

        if segmenter is None:
            raise typer.Exit(code=1)

    print(f"Selected segmenter: {segmenter}")

def main():
    app()

if __name__ == "__main__":
    main()
