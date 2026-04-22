"""
safe_encoder.py
Drop-in replacement for sklearn LabelEncoder that never crashes on unseen
categories at inference time — returns a designated 'unknown' index instead.

Used by all v3 models.
"""

import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin


class SafeLabelEncoder(BaseEstimator, TransformerMixin):
    """
    LabelEncoder that handles unseen categories gracefully.

    - fit()      : learns the mapping from known categories
    - transform(): maps known → integer, unknown → self.unknown_index
    - inverse_transform(): maps integer → category, unknown_index → '__unknown__'
    """

    def __init__(self, unknown_index: int = -1):
        self.unknown_index = unknown_index
        self.classes_ = None
        self._mapping: dict = {}
        self._inv_mapping: dict = {}

    def fit(self, y):
        classes = sorted(set(str(v) for v in y))
        self.classes_ = classes
        self._mapping = {c: i for i, c in enumerate(classes)}
        self._inv_mapping = {i: c for c, i in self._mapping.items()}
        self._inv_mapping[self.unknown_index] = "__unknown__"
        return self

    def transform(self, y):
        return np.array([self._mapping.get(str(v), self.unknown_index) for v in y])

    def inverse_transform(self, y):
        return np.array([self._inv_mapping.get(int(v), "__unknown__") for v in y])

    def fit_transform(self, y, **_):
        return self.fit(y).transform(y)

    def __len__(self):
        return len(self.classes_) if self.classes_ else 0
