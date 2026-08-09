import torch
import torch.nn as nn


class LSTMAutoencoder(nn.Module):
    """
    Encoder: compresses a (window_size, num_features) sequence into a single latent vector.
    Decoder: expands that latent vector back into a reconstructed (window_size, num_features) sequence.
    Trained only on normal data — learns to reconstruct normal patterns well;
    reconstruction error on new data becomes the anomaly signal.
    """

    def __init__(self, num_features: int, window_size: int, hidden_size: int = 32):
        super().__init__()
        self.window_size = window_size
        self.hidden_size = hidden_size

        # Encoder: reads the sequence step by step, its final hidden state summarizes the whole window
        self.encoder = nn.LSTM(
            input_size=num_features,
            hidden_size=hidden_size,
            num_layers=1,
            batch_first=True,
        )

        # Decoder: takes the repeated latent vector and expands it back into a full sequence
        self.decoder = nn.LSTM(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=1,
            batch_first=True,
        )

        # Maps each decoder timestep's output back to the original 9-feature space
        self.output_layer = nn.Linear(hidden_size, num_features)

    def forward(self, x):
        # x shape: (batch, window_size, num_features)

        # --- Encode ---
        _, (hidden, _) = self.encoder(x)
        # hidden shape: (1, batch, hidden_size) — the compressed summary of the whole sequence

        # --- Prepare for decoding ---
        # Repeat the single latent vector once per timestep, so the decoder has
        # something to work with at every position in the output sequence
        latent = hidden.repeat(self.window_size, 1, 1).permute(1, 0, 2)
        # latent shape: (batch, window_size, hidden_size)

        # --- Decode ---
        decoded, _ = self.decoder(latent)
        # decoded shape: (batch, window_size, hidden_size)

        # --- Map back to original feature space ---
        reconstructed = self.output_layer(decoded)
        # reconstructed shape: (batch, window_size, num_features) — same shape as input

        return reconstructed
