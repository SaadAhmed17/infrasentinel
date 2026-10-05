"""LSTM-Autoencoder architecture tests (ML-MOD-xxx)."""

import pytest
import torch

from model import LSTMAutoencoder


@pytest.mark.parametrize("batch", [1, 7])
def test_ML_MOD_001_reconstruction_has_exactly_the_input_shape(batch):
    model = LSTMAutoencoder(num_features=9, window_size=20)

    out = model(torch.rand(batch, 20, 9))

    assert out.shape == (batch, 20, 9)


def test_ML_MOD_002_inference_is_deterministic_in_eval_mode():
    torch.manual_seed(0)
    model = LSTMAutoencoder(num_features=9, window_size=20).eval()
    x = torch.rand(4, 20, 9)

    with torch.no_grad():
        assert torch.equal(model(x), model(x))


def test_ML_MOD_003_model_can_learn_sanity_check_overfits_a_tiny_batch():
    """Standard ML smoke test: if a model cannot overfit 8 samples, something in
    the architecture or wiring is broken (e.g. gradients not flowing)."""
    torch.manual_seed(0)
    model = LSTMAutoencoder(num_features=9, window_size=20)
    x = torch.rand(8, 20, 9)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn = torch.nn.MSELoss()
    initial = loss_fn(model(x), x).item()

    for _ in range(300):
        optimizer.zero_grad()
        loss = loss_fn(model(x), x)
        loss.backward()
        optimizer.step()

    assert loss.item() < initial * 0.5
