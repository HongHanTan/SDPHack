import builtins

from simulation.swmm.engine import probe_engine


def test_missing_native_package_is_reported_not_faked(monkeypatch):
    original_import = builtins.__import__

    def missing_swmm(name, *args, **kwargs):
        if name == "swmm.toolkit":
            raise ModuleNotFoundError("swmm.toolkit is not installed")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", missing_swmm)
    result = probe_engine()
    assert result["available"] is False
    assert result["engine_version"] is None
    assert result["execution_verified"] is False
    assert "ModuleNotFoundError" in result["message"]
