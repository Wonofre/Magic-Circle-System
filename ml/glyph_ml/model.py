from __future__ import annotations

import torch
from torch import nn
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small


def build_model(
    class_count: int,
    *,
    pretrained: bool,
) -> nn.Module:
    weights = MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    model = mobilenet_v3_small(weights=weights)
    original = model.features[0][0]
    replacement = nn.Conv2d(
        1,
        original.out_channels,
        kernel_size=original.kernel_size,
        stride=original.stride,
        padding=original.padding,
        dilation=original.dilation,
        groups=original.groups,
        bias=original.bias is not None,
        padding_mode=original.padding_mode,
    )
    if pretrained:
        with torch.no_grad():
            replacement.weight.copy_(original.weight.mean(dim=1, keepdim=True))
            if original.bias is not None and replacement.bias is not None:
                replacement.bias.copy_(original.bias)
    model.features[0][0] = replacement
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, class_count)
    return model
