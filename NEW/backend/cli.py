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
    segmenter: Segmenter = typer.Option(
        Segmenter.otsuhull,
        "--segmenter",
        "-s",
        help="Segmentation method (default: otsuhull).",
        show_default=True,
    ),
    num_samples: int = typer.Option(
        1,
        "--num-samples",
        help="Stride for sampling slices; 1 keeps every slice, 2 keeps every other slice.",
        show_default=True,
    ),
    middle_percent: int = typer.Option(
        100,
        "--middle-percent",
        min=1,
        max=100,
        help="Percent of middle slices to keep per series (1-100).",
        show_default=True,
    ),
    save_fgbg: bool = typer.Option(
        False,
        "--save-fgbg",
        help="If set, save per-participant foreground/background masks.",
        show_default=True,
    ),
):
    typer.echo(
        f"Selected segmenter: {segmenter.value if isinstance(segmenter, Segmenter) else segmenter} | "
        f"num_samples={num_samples} | "
        f"middle_percent={middle_percent} | "
        f"save_fgbg={'yes' if save_fgbg else 'no'}"
    )

def main():
    app()

if __name__ == "__main__":
    main()
